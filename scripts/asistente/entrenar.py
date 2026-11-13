"""Entrena el clasificador de intenciones y lo exporta a la Edge Function.

Uso desde la raíz del repositorio (requiere scikit-learn y numpy):

    python scripts/asistente/entrenar.py            # entrena, evalúa y exporta
    python scripts/asistente/entrenar.py --sin-exportar

Genera:
  supabase/functions/asistente/model_data.ts           pesos del modelo
  supabase/functions/asistente/testdata/model_parity.json  casos para comprobar
      que TypeScript calcula las mismas probabilidades que Python.

El modelo es TF-IDF de palabras (1-2) + TF-IDF de caracteres (3-5) con
regresión logística multinomial. La inferencia en TypeScript replica
exactamente estos pasos (model.ts).
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).resolve().parents[2]
FUNCION = ROOT / "supabase" / "functions" / "asistente"
sys.path.insert(0, str(Path(__file__).resolve().parent))

from datos_entrenamiento import INTENTS, construir  # noqa: E402

C = 8.0


def normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFD", texto.lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", texto).strip()


def vectorizadores() -> tuple[TfidfVectorizer, TfidfVectorizer]:
    palabras = TfidfVectorizer(
        preprocessor=normalizar, lowercase=False, analyzer="word",
        token_pattern=r"(?u)\b\w\w+\b", ngram_range=(1, 2),
        sublinear_tf=True, min_df=2,
    )
    caracteres = TfidfVectorizer(
        preprocessor=normalizar, lowercase=False, analyzer="char_wb",
        ngram_range=(3, 5), sublinear_tf=True, min_df=3,
    )
    return palabras, caracteres


def leer_banco(nombre: str) -> list[tuple[str, str]]:
    ruta = FUNCION / "testdata" / nombre
    filas = []
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        if linea.strip():
            intencion, texto = linea.split("\t", 1)
            filas.append((intencion, texto))
    return filas


def entrenar():
    filas = construir()
    textos = [t for _, t in filas]
    y = np.array([INTENTS.index(i) for i, _ in filas])
    palabras, caracteres = vectorizadores()
    X = hstack([palabras.fit_transform(textos), caracteres.fit_transform(textos)]).tocsr()
    modelo = LogisticRegression(C=C, max_iter=3000)
    modelo.fit(X, y)
    return filas, palabras, caracteres, modelo


def predecir(textos, palabras, caracteres, modelo) -> np.ndarray:
    X = hstack([palabras.transform(textos), caracteres.transform(textos)]).tocsr()
    return modelo.predict_proba(X)


def b64(valores: np.ndarray) -> str:
    return base64.b64encode(np.asarray(valores, dtype="<f8").tobytes()).decode("ascii")


def exportar(palabras, caracteres, modelo, n_filas: int) -> None:
    vocab_p = sorted(palabras.vocabulary_, key=palabras.vocabulary_.get)
    vocab_c = sorted(caracteres.vocabulary_, key=caracteres.vocabulary_.get)
    datos = {
        "version": 2,
        "trainingRows": n_filas,
        "classes": [INTENTS[i] for i in modelo.classes_],
        "wordVocabulary": vocab_p,
        "wordIdf": b64(palabras.idf_),
        "charVocabulary": vocab_c,
        "charIdf": b64(caracteres.idf_),
        "coefficients": b64(modelo.coef_.ravel()),
        "intercepts": b64(modelo.intercept_),
    }
    cuerpo = json.dumps(datos, ensure_ascii=False, separators=(",", ":"))
    (FUNCION / "model_data.ts").write_text(
        "// deno-fmt-ignore-file\n"
        "// Archivo generado por scripts/asistente/entrenar.py. No editar a mano.\n"
        f"export const MODEL_DATA = {cuerpo};\n",
        encoding="utf-8",
    )


def exportar_paridad(palabras, caracteres, modelo) -> None:
    textos = [t for _, t in leer_banco("benchmark_dev.tsv")]
    probas = predecir(textos, palabras, caracteres, modelo)
    casos = [
        {"text": t, "probabilities": dict(zip([INTENTS[i] for i in modelo.classes_], p.tolist()))}
        for t, p in zip(textos, probas)
    ]
    (FUNCION / "testdata" / "model_parity.json").write_text(
        json.dumps({"cases": casos}, ensure_ascii=False, indent=1), encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sin-exportar", action="store_true")
    args = parser.parse_args()

    filas, palabras, caracteres, modelo = entrenar()
    print(f"filas de entrenamiento: {len(filas)}")
    print(f"vocabulario: {len(palabras.vocabulary_)} palabras, {len(caracteres.vocabulary_)} n-gramas")
    entrenamiento = {normalizar(t) for _, t in filas}
    for banco in ("benchmark_dev.tsv",):
        datos = leer_banco(banco)
        probas = predecir([t for _, t in datos], palabras, caracteres, modelo)
        pred = [INTENTS[modelo.classes_[i]] for i in probas.argmax(axis=1)]
        aciertos = sum(p == g for p, (g, _) in zip(pred, datos))
        nuevas = [(p, g) for p, (g, t) in zip(pred, datos) if normalizar(t) not in entrenamiento]
        print(f"{banco}: {aciertos}/{len(datos)} = {100 * aciertos / len(datos):.1f} % "
              f"(sólo frases que no están en el entrenamiento: "
              f"{sum(p == g for p, g in nuevas)}/{len(nuevas)})")
    if not args.sin_exportar:
        exportar(palabras, caracteres, modelo, len(filas))
        exportar_paridad(palabras, caracteres, modelo)
        print("exportado model_data.ts y testdata/model_parity.json")


if __name__ == "__main__":
    main()
