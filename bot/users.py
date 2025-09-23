"""Белый список пользователей Telegram-бота."""

from __future__ import annotations

from typing import Dict

from .start import UserEntry

DEFAULT_USERS: Dict[int, UserEntry] = {
    7247710860: UserEntry(
        telegram_id=7247710860,
        full_name="Александр Пинаев",
        role="Администратор системы задач",
        username="@apin",
    ),
    1000000001: UserEntry(
        telegram_id=1000000001,
        full_name="Илья Колпаков",
        role="Руководитель сообщества Буколпак",
        username="@kolpakov",
    ),
}
"""Белый список по умолчанию для сценариев разработки."""
