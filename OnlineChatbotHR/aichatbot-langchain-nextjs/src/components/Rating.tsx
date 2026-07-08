"use client";

import React, { useState } from "react";
import { Star } from "lucide-react";

interface RatingProps {
  maxRating?: number;
  defaultValue?: number;
  value?: number;
  onChange?: (rating: number) => void;
  size?: number;
  className?: string;
  readOnly?: boolean;
}

const Rating: React.FC<RatingProps> = ({
  maxRating = 5,
  defaultValue = 0,
  value,
  onChange,
  size = 32,
  className = "",
  readOnly = false,
}) => {
  const [internalRating, setInternalRating] = useState(defaultValue);
  const [hover, setHover] = useState(0);

  const currentRating = value !== undefined ? value : internalRating;

  const handleClick = (rating: number) => {
    if (readOnly) return;

    if (value === undefined) {
      setInternalRating(rating);
    }

    onChange?.(rating);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[...Array(maxRating)].map((_, index) => {
        const ratingValue = index + 1;
        const isFilled = ratingValue <= (hover || currentRating);

        return (
          <button
            key={index}
            type="button"
            onClick={() => handleClick(ratingValue)}
            onMouseEnter={() => !readOnly && setHover(ratingValue)}
            onMouseLeave={() => setHover(0)}
            disabled={readOnly}
            className={`transition-all duration-200 ${
              readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"
            }`}
            aria-label={`Rate ${ratingValue} out of ${maxRating}`}
          >
            <Star
              size={size}
              className={`transition-colors duration-200 ${
                isFilled
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-none text-gray-300"
              }`}
            />
          </button>
        );
      })}
      {currentRating > 0 && (
        <span className="ml-2 text-sm text-gray-600">
          {currentRating} / {maxRating}
        </span>
      )}
    </div>
  );
};

export default Rating;
