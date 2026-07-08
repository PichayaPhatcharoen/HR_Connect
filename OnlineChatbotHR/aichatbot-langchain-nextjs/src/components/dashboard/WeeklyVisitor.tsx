import React from "react";

type Props = {
    text: string;
    value: number
}

const WeeklyVisitor = ({ text, value }: Props) => {
  return (
    <div className='bg-white rounded-2xl px-6 py-3 text-center flex flex-col gap-y-3'>
        <div className='text-lg text-gray-500'>{text}</div>
        <div className='text-4xl font-bold'>{value}</div>
    </div>
  )
}

export default WeeklyVisitor
