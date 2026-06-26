from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database


class MongoDatabase:
    def __init__(self, uri: str, database_name: str) -> None:
        self.client: MongoClient = MongoClient(uri, serverSelectionTimeoutMS=3000)
        self.database: Database = self.client[database_name]

    def ping(self) -> dict[str, Any]:
        return self.client.admin.command("ping")

    def collection(self, name: str) -> Collection:
        return self.database[name]

    def collection_names(self) -> list[str]:
        return self.database.list_collection_names()

    def estimated_counts(self, names: Iterable[str]) -> dict[str, int]:
        return {name: int(self.collection(name).estimated_document_count()) for name in names}
