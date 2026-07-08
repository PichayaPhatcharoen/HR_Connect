import React from "react";
import Rating from "@/components/Rating";

type Props = {
  rating: number;
  comment: string;
  createdAt: string;
};

const FeedbackCard = ({ rating, comment, createdAt }: Props) => {
  return (
    <div className="bg-gray-50 rounded-2xl p-6 shadow-lg w-full">
        <div className="flex flex-col justify-center items-center w-full">
            <Rating value={rating} size={16} readOnly={true}/>
            <p className="text-lg mt-2">{comment}</p>
        </div>
      <p className="mt-6 text-right text-sm">{createdAt}</p>
    </div>
  );
};

export default FeedbackCard;
