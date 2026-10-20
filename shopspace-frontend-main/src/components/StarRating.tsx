import React from 'react';

interface StarRatingProps {
  /** Current rating. Can be fractional (e.g. 4.5) in read-only display mode. */
  value: number;
  /** If provided, renders clickable stars and calls this with the picked whole number 1-5. */
  onChange?: (value: number) => void;
  size?: number;
}

const StarRating: React.FC<StarRatingProps> = ({ value, onChange, size = 18 }) => {
  const interactive = Boolean(onChange);

  return (
    <div className="star-rating" role={interactive ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        let iconClass = 'ti-star';
        if (value >= n) iconClass = 'ti-star-filled';
        else if (value >= n - 0.5) iconClass = 'ti-star-half-filled';

        if (!interactive) {
          return (
            <i
              key={n}
              className={`ti ${iconClass} star-rating-icon`}
              style={{ fontSize: size }}
              aria-hidden="true"
            ></i>
          );
        }

        return (
          <button
            key={n}
            type="button"
            className="star-rating-btn"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            aria-pressed={value >= n}
            onClick={() => onChange && onChange(n)}
          >
            <i className={`ti ${iconClass} star-rating-icon`} style={{ fontSize: size }} aria-hidden="true"></i>
          </button>
        );
      })}
    </div>
  );
};

export default StarRating;
