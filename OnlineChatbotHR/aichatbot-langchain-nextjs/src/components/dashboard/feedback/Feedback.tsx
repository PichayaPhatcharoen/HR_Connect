"use client";

import React from 'react'
import FeedbackCard from './FeedbackCard'
import FeedbackBar from './FeedbackBar'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

const Feedback = () => {
  const { data } = useQuery({
    queryKey: ['feedbacks', 'limit', 10],
    queryFn: () => axios.get('/api/feedback?limit=4').then((res) => res.data),
    initialData: []
  })

  return (
    <div className='bg-white rounded-2xl p-6'>
      <h1 className='text-2xl font-bold'>Feedback</h1>
      <FeedbackBar />
      <div className='grid grid-cols-4 mt-16 px-6 gap-x-5 gap-y-3'>
        {data?.map((item: { rating: number, comment: string, createdAt: string }, index: number) => (
          <FeedbackCard key={index} rating={item.rating} comment={item.comment} createdAt={item.createdAt} />
        ))}
      </div>
    </div>
  )
}

export default Feedback