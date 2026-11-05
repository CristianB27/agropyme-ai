"""Exporta el clasificador congelado a parámetros consumibles por Deno.

El modelo original de scikit-learn no se modifica. Este exportador crea una
representación numérica de sus transformadores y pesos para ejecutar la misma
inferencia dentro de la Supabase Edge Function, sin un runtime de Python.

Uso desde la raíz del repositorio:

    experimentos/asistente_propio/.venv/Scripts/python.exe \
        scripts/export_assistant_model.py
"""

from __future__ import annotations

import ast
import base64
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import joblib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
EXPERIMENT = ROOT / "experimentos" / "asistente_propio"
MODEL_PATH = EXPERIMENT / "artifacts" / "model.joblib"
FEATURES_PATH = EXPERIMENT / "src" / "features.py"
OUTPUT_PATH = ROOT / "supabase" / "functions" / "asistente" / "model_data.ts"
PARITY_PATH = (
    ROOT / "supabase" / "functions" / "asistente" / "testdata" /
    "model_parity.json"
)

sys.path.insert(0, str(EXPERIMENT))

from src.intents import INTENTS  # noqa: E402
from src.model import probability_matrix  # noqa: E402


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def float64_base64(values: np.ndarray) -> str:
    array = np.asarray(values, dtype="<f8")
    return base64.b64encode(array.tobytes(order="C")).decode("ascii")


def lexical_rule_groups() -> dict[str, list[str]]:
    """Extrae los grupos literales de ``features.lexical_features``."""
    tree = ast.parse(FEATURES_PATH.read_text(encoding="utf-8"))
    function = next(
        (
            node
            for node in tree.body
            if isinstance(node, ast.FunctionDef) and node.name == "lexical_features"
        ),
        None,
    )
    require(function is not None, "No se encontró lexical_features en features.py")
    assignment = next(
        (
            node
            for node in function.body
            if isinstance(node, ast.Assign)
            and any(
                isinstance(target, ast.Name) and target.id == "groups"
                for target in node.targets
            )
        ),
        None,
    )
    require(assignment is not None, "No se encontró el diccionario groups")
    groups = ast.literal_eval(assignment.value)
    require(isinstance(groups, dict), "groups no es un diccionario literal")
    return {
        str(name): [str(word) for word in words]
        for name, words in groups.items()
    }


def export_model_data(bundle: dict[str, Any]) -> dict[str, Any]:
    model = bundle["model"]
    require(hasattr(model, "named_steps"), "El modelo no es un Pipeline compatible")
    features = model.named_steps["features"]
    parts = dict(features.transformer_list)
    require(
        set(parts) == {"palabras", "caracteres", "reglas_entidades"},
        f"Partes inesperadas del pipeline: {sorted(parts)}",
    )

    word = parts["palabras"]
    char = parts["caracteres"]
    rules = parts["reglas_entidades"]
    require(word.analyzer == "word", "El vectorizador de palabras cambió")
    require(word.ngram_range == (1, 2), "El rango de palabras cambió")
    require(
        char.analyzer == "char_wb" and char.ngram_range == (3, 5),
        "La configuración char_wb cambió",
    )
    require(
        bool(word.sublinear_tf) and bool(char.sublinear_tf),
        "El modelo exige TF-IDF sublineal",
    )
    require(
        word.norm == "l2" and char.norm == "l2",
        "El modelo exige normalización L2",
    )

    rule_vectorizer = rules.named_steps["vectorizar"]
    rule_vocabulary = {
        str(name): int(index)
        for name, index in sorted(rule_vectorizer.vocabulary_.items())
    }

    classifier = model.named_steps["classifier"]
    require(
        classifier.__class__.__name__ == "CalibratedClassifierCV",
        "El clasificador calibrado cambió de familia",
    )
    require(
        len(classifier.calibrated_classifiers_) == 1,
        "Se esperaba calibración con ensemble=False",
    )
    calibrated = classifier.calibrated_classifiers_[0]
    estimator = calibrated.estimator
    require(
        estimator.__class__.__name__ == "LogisticRegression",
        "El estimador base cambió de familia",
    )
    require(
        len(calibrated.calibrators) == len(classifier.classes_),
        "No hay un calibrador por clase",
    )
    expected_features = (
        len(word.vocabulary_) + len(char.vocabulary_) + len(rule_vocabulary)
    )
    require(
        estimator.coef_.shape == (len(classifier.classes_), expected_features),
        f"Forma inesperada de coeficientes: {estimator.coef_.shape}",
    )

    return {
        "version": 1,
        "sourceModelSha256": sha256(MODEL_PATH),
        "threshold": float(bundle["threshold"]),
        "canonicalIntents": list(INTENTS),
        "classes": [str(value) for value in classifier.classes_],
        "wordVocabulary": {
            str(term): int(index)
            for term, index in sorted(word.vocabulary_.items())
        },
        "wordIdf": float64_base64(word.idf_),
        "charVocabulary": {
            str(term): int(index)
            for term, index in sorted(char.vocabulary_.items())
        },
        "charIdf": float64_base64(char.idf_),
        "ruleGroups": lexical_rule_groups(),
        "ruleVocabulary": rule_vocabulary,
        "coefficients": float64_base64(estimator.coef_),
        "intercepts": float64_base64(estimator.intercept_),
        "calibratorA": float64_base64(
            np.asarray([calibrator.a_ for calibrator in calibrated.calibrators])
        ),
        "calibratorB": float64_base64(
            np.asarray([calibrator.b_ for calibrator in calibrated.calibrators])
        ),
    }


def typescript_literal(value: Any, indent: int = 0) -> str:
    """Serializa JSON como literal TypeScript sin depender de json.dumps."""
    prefix = "  " * indent
    inner = "  " * (indent + 1)
    if isinstance(value, dict):
        if not value:
            return "{}"
        lines = ["{"]
        for key, item in value.items():
            rendered = typescript_literal(item, indent + 1)
            lines.append(f'{inner}{json.dumps(str(key))}: {rendered},')
        lines.append(prefix + "}")
        return "\n".join(lines)
    if isinstance(value, list):
        if not value:
            return "[]"
        lines = ["["]
        for item in value:
            lines.append(f"{inner}{typescript_literal(item, indent + 1)},")
        lines.append(prefix + "]")
        return "\n".join(lines)
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    return json.dumps(str(value), ensure_ascii=False)


def write_model_data(data: dict[str, Any]) -> None:
    rendered = typescript_literal(data)
    content = (
        "// deno-fmt-ignore-file\n"
        "// Archivo generado por scripts/export_assistant_model.py.\n"
        "// No editar manualmente; volver a ejecutar el exportador.\n"
        f"export const MODEL_DATA = {rendered} as const;\n"
    )
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(content, encoding="utf-8", newline="\n")


def write_parity_fixture(bundle: dict[str, Any]) -> None:
    dev_path = EXPERIMENT / "data" / "dev.jsonl"
    rows = [
        json.loads(line)
        for line in dev_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    texts = [str(row["text"]) for row in rows]
    probabilities = probability_matrix(bundle["model"], texts)
    fixture = {
        "source": "data/dev.jsonl",
        "sourceSha256": sha256(dev_path),
        "cases": [
            {
                "id": str(row["id"]),
                "text": text,
                "expectedIntent": str(row["intent"]),
                "expectedProbabilities": [
                    float(value) for value in probabilities[index]
                ],
            }
            for index, (row, text) in enumerate(zip(rows, texts))
        ],
    }
    PARITY_PATH.parent.mkdir(parents=True, exist_ok=True)
    PARITY_PATH.write_text(
        json.dumps(fixture, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def main() -> None:
    require(MODEL_PATH.exists(), f"No existe el modelo: {MODEL_PATH}")
    bundle = joblib.load(MODEL_PATH)
    data = export_model_data(bundle)
    write_model_data(data)
    write_parity_fixture(bundle)
    print(f"Modelo exportado: {OUTPUT_PATH}")
    print(f"Fixture de paridad: {PARITY_PATH}")
    print(f"SHA-256 del modelo fuente: {data['sourceModelSha256']}")


if __name__ == "__main__":
    main()
