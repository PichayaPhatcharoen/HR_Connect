"use client";

import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartData,
  ChartOptions,
  TooltipItem,
} from "chart.js";
import { Line } from "react-chartjs-2";

// ลงทะเบียน components ของ Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ChatEngagement = () => {
  const [chartData, setChartData] = useState<ChartData<"line"> | null>(null);

  useEffect(() => {
    // สร้าง labels สำหรับ 24 ชั่วโมงย้อนหลัง โดยมี gap 3 ชั่วโมง (8 จุด)
    const labels: string[] = [];
    const now = new Date();

    for (let i = 7; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 3 * 60 * 60 * 1000);
      const hours = time.getHours().toString().padStart(2, "0");
      const minutes = time.getMinutes().toString().padStart(2, "0");
      labels.push(`${hours}:${minutes}`);
    }

    // สร้างข้อมูลตัวอย่าง (คุณสามารถแทนที่ด้วยข้อมูลจริงจาก API)
    const data = Array.from(
      { length: 8 },
      () => Math.floor(Math.random() * 100) + 20
    );

    setChartData({
      labels,
      datasets: [
        {
          label: "Chat Engagement",
          data: data,
          borderColor: "rgb(59, 130, 246)",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          fill: true,
          tension: 0,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: "rgb(59, 130, 246)",
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    });
  }, []);

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          font: {
            size: 14,
            family: "Arial, sans-serif",
          },
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        titleFont: {
          size: 14,
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function (context: TooltipItem<"line">) {
            return `${context.dataset.label}: ${context.parsed.y} ครั้ง`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 12,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          font: {
            size: 12,
          },
          callback: function (tickValue: string | number) {
            return tickValue + " ครั้ง";
          },
        },
      },
    },
  };

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold">Chat Engagement</h1>
      <div className="h-[400px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
};

export default ChatEngagement;
