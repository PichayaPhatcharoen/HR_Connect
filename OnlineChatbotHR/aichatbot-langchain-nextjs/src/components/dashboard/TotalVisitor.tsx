import React from "react";
import { FaAnglesDown, FaAnglesUp } from "react-icons/fa6";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  value: {
    previous: number;
    current: number;
  };
};

const TotalVisitor = ({ text, value }: Props) => {
  const percentage = ((value.current - value.previous) / value.previous) * 100;
  return (
    <div className="bg-white rounded-2xl px-6 py-3 text-center flex flex-col gap-y-3">
      <div className="text-lg text-gray-500">{text}</div>
      <div className="text-4xl font-bold text-black">
        {value.current}
      </div>
      <div className={cn('text-sm text-gray-500 flex gap-x-3 justify-center items-center', value.current > value.previous ? 'text-green-700' : 'text-red-500')}>{value.current > value.previous ? <FaAnglesUp /> : <FaAnglesDown />}{percentage.toFixed(2)}%</div>
    </div>
  );
};

export default TotalVisitor;
