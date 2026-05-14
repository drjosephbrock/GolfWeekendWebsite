from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./golf.db"
    admin_password: str = "changeme"

    model_config = {"env_file": ".env"}


settings = Settings()
