use crate::types::{BoardCategory, ApiError};

pub type BoardsMask = u32;

pub fn boards_mask_from_categories(categories: &[BoardCategory]) -> BoardsMask {
    let mut mask = 0u32;
    for category in categories {
        let bit = category_to_bit(category);
        mask |= 1 << bit;
    }
    mask
}

pub fn category_to_bit(category: &BoardCategory) -> u8 {
    match category {
        BoardCategory::Government => 0,
        BoardCategory::Healthcare => 1,
        BoardCategory::Corporate => 2,
        BoardCategory::Media => 3,
        BoardCategory::Environment => 4,
        BoardCategory::Legal => 5,
        BoardCategory::Education => 6,
        BoardCategory::CivilSociety => 7,
    }
}

pub fn is_board_granted(mask: BoardsMask, category: &BoardCategory) -> bool {
    let bit = category_to_bit(category);
    (mask & (1 << bit)) != 0
}

pub fn validate_board_access(
    mask: BoardsMask,
    category: &BoardCategory,
) -> Result<(), ApiError> {
    if !is_board_granted(mask, category) {
        return Err(ApiError::InvalidInput(format!(
            "Board {:?} not granted",
            category
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_board() {
        let categories = vec![BoardCategory::Healthcare];
        let mask = boards_mask_from_categories(&categories);
        assert!(is_board_granted(mask, &BoardCategory::Healthcare));
        assert!(!is_board_granted(mask, &BoardCategory::Government));
    }

    #[test]
    fn test_multiple_boards() {
        let categories = vec![
            BoardCategory::Healthcare,
            BoardCategory::Media,
            BoardCategory::Legal,
        ];
        let mask = boards_mask_from_categories(&categories);
        assert!(is_board_granted(mask, &BoardCategory::Healthcare));
        assert!(is_board_granted(mask, &BoardCategory::Media));
        assert!(is_board_granted(mask, &BoardCategory::Legal));
        assert!(!is_board_granted(mask, &BoardCategory::Corporate));
    }

    #[test]
    fn test_all_boards() {
        let categories = vec![
            BoardCategory::Government,
            BoardCategory::Healthcare,
            BoardCategory::Corporate,
            BoardCategory::Media,
            BoardCategory::Environment,
            BoardCategory::Legal,
            BoardCategory::Education,
            BoardCategory::CivilSociety,
        ];
        let mask = boards_mask_from_categories(&categories);
        for cat in categories {
            assert!(is_board_granted(mask, &cat));
        }
    }
}
