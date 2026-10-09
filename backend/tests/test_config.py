"""Settings: "<...>" template values copied from the docs must count as unset."""
import logging

from app.core.config import Settings


def test_placeholders_are_treated_as_unset(caplog):
    with caplog.at_level(logging.WARNING, logger="cadlift.config"):
        s = Settings(_env_file=None, fal_key="<your fal key>", world_labs_api_key=" <from platform.worldlabs.ai> ",
                     azure_image_deployment_name="<your gpt-image-1 deployment name>",
                     azure_video_deployment_name="sora-2")
    assert s.fal_key is None and s.world_labs_api_key is None and s.azure_image_deployment_name is None
    assert s.azure_video_deployment_name == "sora-2"
    assert "FAL_KEY" in caplog.text and "WORLD_LABS_API_KEY" in caplog.text and "SORA" not in caplog.text


def test_real_values_with_angle_brackets_inside_are_kept():
    s = Settings(_env_file=None, fal_key="abc<def>", jwt_secret_key="x>y<z")
    assert s.fal_key == "abc<def>" and s.jwt_secret_key == "x>y<z"


def test_no_warning_without_placeholders(caplog):
    with caplog.at_level(logging.WARNING, logger="cadlift.config"):
        Settings(_env_file=None, fal_key="real")
    assert "placeholder" not in caplog.text
