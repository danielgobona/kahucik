from kahucik_api.services.scoring import score_answer, speed_points


def test_speed_points_fastest():
    assert speed_points(200, 20) == 1000


def test_speed_points_mid():
    # 10s into 20s timer => ratio 0.5 => (1 - 0.25) * 1000 = 750
    assert speed_points(10_000, 20) == 750


def test_quiz_correct():
    ok, pts = score_answer(
        "quiz",
        20,
        200,
        {"option_id": "a"},
        {"correct_option_id": "a"},
    )
    assert ok and pts == 1000


def test_quiz_incorrect():
    ok, pts = score_answer(
        "quiz",
        20,
        200,
        {"option_id": "b"},
        {"correct_option_id": "a"},
    )
    assert not ok and pts == 0


def test_multi_select_partial():
    ok, pts = score_answer(
        "multi_select",
        20,
        200,
        {"option_ids": ["a"]},
        {"correct_option_ids": ["a", "b"]},
    )
    assert not ok and pts == 500


def test_multi_select_full():
    ok, pts = score_answer(
        "multi_select",
        20,
        200,
        {"option_ids": ["a", "b"]},
        {"correct_option_ids": ["a", "b"]},
    )
    assert ok and pts == 1000


def test_multi_select_wrong_penalty():
    ok, pts = score_answer(
        "multi_select",
        20,
        200,
        {"option_ids": ["a", "c"]},
        {"correct_option_ids": ["a", "b"]},
    )
    assert not ok and pts == 0


def test_puzzle_order():
    ok, pts = score_answer(
        "puzzle",
        20,
        1000,
        {"ordered_option_ids": ["1", "2", "3"]},
        {"ordered_option_ids": ["1", "2", "3"]},
    )
    assert ok and pts > 0


def test_puzzle_wrong_order():
    ok, pts = score_answer(
        "puzzle",
        20,
        1000,
        {"ordered_option_ids": ["2", "1", "3"]},
        {"ordered_option_ids": ["1", "2", "3"]},
    )
    assert not ok and pts == 0
