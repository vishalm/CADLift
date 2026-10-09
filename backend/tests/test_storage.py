"""StorageService.delete: used by job and render deletion."""
import pytest

from app.services.storage import StorageService


def test_delete_removes_file_and_tolerates_missing(tmp_path):
    store = StorageService(str(tmp_path))
    key, _ = store.save_bytes(b"x", role="output", job_id="j1", filename="a.bin")
    assert store.resolve_path(key).exists()
    store.delete(key)
    assert not store.resolve_path(key).exists()
    store.delete(key)  # already gone: no error


@pytest.mark.parametrize("key", ["../outside.txt", "j1/../../outside.txt"])
def test_delete_refuses_paths_outside_root(tmp_path, key):
    outside = tmp_path / "outside.txt"
    outside.write_text("keep")
    store = StorageService(str(tmp_path / "storage"))
    with pytest.raises(ValueError, match="outside storage root"):
        store.delete(key)
    assert outside.exists()
