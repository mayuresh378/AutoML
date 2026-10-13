"""The in-memory live-progress stores used by training/HPO/engine must be bounded.

Without pruning, every finished job keeps its logs, metrics and results resident
for the life of the process — an unbounded memory leak on a long-running server.
"""
from main import _prune_progress_store


def test_prune_is_noop_below_limit():
    store = {f"j{i}": {"status": "completed"} for i in range(5)}
    _prune_progress_store(store, limit=10)
    assert len(store) == 5


def test_prune_evicts_oldest_finished_first():
    store = {f"j{i}": {"status": "completed" if i < 8 else "running"} for i in range(10)}
    _prune_progress_store(store, limit=5)
    assert len(store) == 5
    # Oldest finished jobs go first; the newest finished ones and every running
    # job survive.
    assert set(store) == {"j5", "j6", "j7", "j8", "j9"}


def test_prune_drops_finished_before_running():
    store = {
        "run": {"status": "running"},
        "done-a": {"status": "completed"},
        "done-b": {"status": "failed"},
    }
    _prune_progress_store(store, limit=1)
    assert list(store) == ["run"]


def test_prune_still_bounds_when_everything_is_active():
    store = {f"j{i}": {"status": "running"} for i in range(10)}
    _prune_progress_store(store, limit=3)
    assert len(store) == 3
