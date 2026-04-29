from pydantic import BaseModel, EmailStr


class PersonnelCreateRequest(BaseModel):
    name: str
    email: EmailStr | None = None
    role: str | None = None
    badge_number: str | None = None
