import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const data = [
  {
    question: "ปีนี้มีวันหยุดชดเชยวันไหนบ้าง ?",
    count: 48,
  },
  {
    question: "จะขอหนังสือรับรองเงินเดือนต้องทำอย่างไร ?",
    count: 31,
  },
  {
    question: "ขอเบิกค่าสวัสดิการสุขภาพทำอย่างไร ?",
    count: 20,
  },
  {
    question: "จะตรวจสอบเงินเดือนย้อนหลังได้อย่างไร ?",
    count: 18,
  },
  {
    question: "สามารถเข้าอาคารคณะนอกเวลาราชการได้หรือไม่ ?",
    count: 16,
  },
];

const FAQStats = () => {
  return (
    <div className="bg-white rounded-2xl p-6">
      <h1 className="text-2xl font-bold">FAQ Statistics</h1>
      <div className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No.</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Count</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{item.question}</TableCell>
                <TableCell>{item.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default FAQStats;
