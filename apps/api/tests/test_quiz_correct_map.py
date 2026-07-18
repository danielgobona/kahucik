from kahucik_api.services.quiz_service import correct_map


def test_puzzle_correct_map_tolerates_none_order():
    result = correct_map(
        {
            "type": "puzzle",
            "options": [
                {"id": "b", "correct_order": 1},
                {"id": "a", "correct_order": 0},
                {"id": "orphan", "correct_order": None},
            ],
        }
    )
    assert result["ordered_option_ids"][0] == "a"
    assert result["ordered_option_ids"][1] == "b"
