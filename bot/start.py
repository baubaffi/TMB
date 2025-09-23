"""Обработчики команд запуска Telegram-бота."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Mapping, MutableMapping, Optional, Union

from zoneinfo import ZoneInfo

LOGGER = logging.getLogger(__name__)
MOSCOW_TZ = ZoneInfo("Europe/Moscow")


@dataclass(frozen=True)
class UserEntry:
    """Описание пользователя для персонализации ответов."""

    telegram_id: int
    full_name: str
    role: str
    username: Optional[str] = None

    @property
    def first_name(self) -> str:
        """Возвращает первое слово из ФИО."""

        return (self.full_name or "").split()[0]


RawUserEntry = Union[UserEntry, Mapping[str, object]]
UserRegistry = Mapping[int, RawUserEntry]


def _ensure_moscow_time(current_dt: Optional[datetime]) -> datetime:
    """Приводит время к часовому поясу Europe/Moscow."""

    if current_dt is None:
        return datetime.now(tz=MOSCOW_TZ)

    if current_dt.tzinfo is None:
        return current_dt.replace(tzinfo=MOSCOW_TZ)

    return current_dt.astimezone(MOSCOW_TZ)


def _resolve_first_name(user_entry: Optional[RawUserEntry]) -> str:
    """Извлекает имя пользователя из справочника."""

    if user_entry is None:
        return "друг"

    if isinstance(user_entry, UserEntry):
        return user_entry.first_name or "друг"

    name_fields = ("full_name", "name", "Имя")
    for field in name_fields:
        name = user_entry.get(field)
        if isinstance(name, str) and name.strip():
            return name.split()[0]

    if "ФИО" in user_entry and isinstance(user_entry["ФИО"], str):
        return user_entry["ФИО"].split()[0]

    return "друг"


def _select_greeting(current_time: datetime) -> str:
    """Подбирает приветствие в зависимости от времени суток по МСК."""

    hour = current_time.hour

    if 5 <= hour <= 10:
        return "Доброе утро"
    if 11 <= hour <= 16:
        return "Добрый день"
    if 17 <= hour <= 22:
        return "Добрый вечер"
    return "Доброй ночи"


def handle_start_command(
    telegram_user_id: int,
    users: UserRegistry,
    current_dt: Optional[datetime] = None,
) -> str:
    """Формирует ответ бота на команду /start."""

    current_time = _ensure_moscow_time(current_dt)
    greeting = _select_greeting(current_time)

    user_entry = users.get(telegram_user_id)
    if user_entry is None:
        LOGGER.info(
            "Приветствие нового пользователя: telegram_user_id=%s",
            telegram_user_id,
        )

    first_name = _resolve_first_name(user_entry)
    return f"{greeting}, {first_name}!"


def register_user(
    users: MutableMapping[int, RawUserEntry],
    telegram_id: int,
    full_name: str,
    role: str,
    username: Optional[str] = None,
) -> None:
    """Добавляет пользователя в справочник."""

    users[telegram_id] = UserEntry(
        telegram_id=telegram_id,
        full_name=full_name,
        role=role,
        username=username,
    )

