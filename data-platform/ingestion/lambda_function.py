"""Retired demonstration collector. Production adapters live in functions/backend."""


def lambda_handler(event, context):
    raise RuntimeError(
        "This JSONPlaceholder demonstration collector is retired. "
        "Use the approved-source Atlas ingestion worker."
    )
