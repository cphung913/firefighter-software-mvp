from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, TimestampMixin, UUIDPKMixin


class Department(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "departments"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    fdid: Mapped[str | None] = mapped_column(String(20), nullable=True)
    state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    subscription_tier: Mapped[str] = mapped_column(
        String(20), nullable=False, default="trial"
    )
    incident_seq: Mapped[int] = mapped_column(
        nullable=False, default=0, server_default="0"
    )
