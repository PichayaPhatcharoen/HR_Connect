import {
  PrismaClient,
  EmployeeStatus,
  EmploymentType,
  FeedbackSource,
  StaffType,
  AcademicPosition,
  SupportPosition,
  ContractType,
  Gender,
  Degree,
  TrainingFormat,
  TrainingCategory,
  TrainingDomain,
  LocationType,
} from '@prisma/client'


import { faker } from '@faker-js/faker/locale/th'
const prisma = new PrismaClient()

// ---------------- YEAR CONFIG ----------------
const YEARS = [2565, 2566, 2567, 2568, 2569]

// function calculateRetirementDate(birthDate: Date) {
//   const retireYear = birthDate.getFullYear() + 60
//   return new Date(retireYear, 8, 30) // 30 กันยายน
// }

function randomDateInYearBE(yearBE: number) {
  const yearCE = yearBE - 543
  return faker.date.between({
    from: new Date(yearCE, 0, 1),
    to: new Date(yearCE, 11, 31)
  })
}
function randomDate(start: Date, end: Date) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  )
}

function calculateWorkDuration(startDate: Date) {
  const now = new Date()
  const diff = now.getTime() - startDate.getTime()
  const years = diff / (1000 * 60 * 60 * 24 * 365)
  return Math.floor(years)
}

function calculateAge(birthDate: Date) {
  const now = new Date()
  let age = now.getFullYear() - birthDate.getFullYear()
  const monthDiff = now.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

function birthDateForRetirementSept30SameYear(retireYearCE: number): Date {
  return new Date(retireYearCE - 60, 2, 15)
}

function pickRetirementYearForNotificationTest(): { retireYear: number; inTwoMonthWindow: boolean } {
  const now = new Date()
  const end = new Date(now)
  end.setMonth(end.getMonth() + 2)

  for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++) {
    const sept30 = new Date(y, 8, 30, 12, 0, 0, 0)
    if (sept30.getTime() >= now.getTime() && sept30.getTime() <= end.getTime()) {
      return { retireYear: y, inTwoMonthWindow: true }
    }
  }
  const y = now.getFullYear()
  const thisSept = new Date(y, 8, 30, 12, 0, 0, 0)
  const retireYear = thisSept.getTime() >= now.getTime() ? y : y + 1
  return { retireYear, inTwoMonthWindow: false }
}

// function getAcademicPosition(name: string): AcademicPosition | null {

//   if (name.startsWith("ศ.")) return AcademicPosition.PROFESSOR
//   if (name.startsWith("รศ.")) return AcademicPosition.ASSOCIATE_PROFESSOR
//   if (name.startsWith("ผศ.")) return AcademicPosition.ASSISTANT_PROFESSOR

//   if (
//     name.startsWith("ดร.") ||
//     name.startsWith("อาจารย์") ||
//     name.startsWith("นาย") ||
//     name.startsWith("นาง") ||
//     name.startsWith("นางสาว")
//   ) {
//     return AcademicPosition.LECTURER
//   }

//   return null
// }

async function seedEmployeeDecorations() {
  const employees = await prisma.employees.findMany()
  const decorations = await prisma.royalDecorations.findMany()

  for (const emp of employees) {

    let maxDecorations = 1
    let chance = 0.3

    // ถ้าเป็นอาจารย์
    if (emp.StaffType === "ACADEMIC") {
      maxDecorations = 4
      chance = 0.8
    }

    // เจ้าหน้าที่
    if (emp.StaffType === "SUPPORT") {
      maxDecorations = 2
      chance = 0.5
    }

    if (Math.random() > chance) continue

    const count = Math.floor(Math.random() * maxDecorations) + 1

    const shuffled = decorations.sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, count)

    for (const dec of selected) {
      await prisma.employeeDecorations.create({
        data: {
          EmployeeId: emp.EmployeeId,
          DecorationId: dec.DecorationId,
          ReceivedDate: randomDate(
            new Date(2005, 0, 1),
            new Date()
          )
        }
      })
    }
  }

  console.log("Employee decorations seeded")
}

const Requests = [
  'ขอสอบถามเรื่องการลาพักร้อน',
  'สอบถามสิทธิประโยชน์พนักงานใหม่',
  'ขอทราบขั้นตอนการเบิกค่าอบรม',
  'ติดต่อเรื่องสัญญาจ้างงาน',
  'ขอเอกสารรับรองเงินเดือน',
  'แจ้งปัญหาการเข้าใช้งานระบบ'
]

type ScoreValue = 1 | 2 | 3 | 4 | 5

const FeedbackCommentByScore: Record<keyof FeedbackScores, Record<ScoreValue, string[]>> = {
  DataAccuracyScore: {
    1: ['ข้อมูลที่แชตบอตไม่ถูกต้อง', 'แชตบอตตอบไม่ตรงความต้องการ', 'คำตอบของแชตบอตยังไม่ถูกต้อง'],
    2: ['ข้อมูลยังคลาดเคลื่อนหลายจุด', 'คำตอบยังไม่ค่อยตรงประเด็นเท่าไหร่', 'อยากให้ปรับความถูกต้องของข้อมูลให้มากขึ้น'],
    3: ['คำตอบพอใช้ได้ แต่ยังมีบางส่วนไม่ชัดเจน', 'ข้อมูลค่อนข้างโอเค แต่ยังไม่ละเอียด', 'ตอบได้ระดับหนึ่ง แต่บางคำถามยังไม่ตรง'],
    4: ['คำตอบค่อนข้างถูกต้อง มีหลุดเล็กน้อย', 'โดยรวมตอบได้ดี เกือบครบถ้วน', 'ข้อมูลถูกต้องเกือบทั้งหมด'],
    5: ['แชตบอตตอบคำถามถูกต้อง'],
  },
  ResponseTimeScore: {
    1: ['ตอบช้ามาก ต้องรอนาน', 'กว่าจะตอบได้ใช้เวลานานเกินไป'],
    2: ['ตอบค่อนข้างช้า อยากให้เร็วขึ้น', 'เวลาตอบยังหน่วง ๆ'],
    3: ['ความเร็วพอใช้ได้ บางช่วงช้า', 'ตอบได้ปกติ แต่บางครั้งรอนิดหน่อย'],
    4: ['ตอบค่อนข้างเร็ว', 'รอไม่นานโดยรวมโอเค'],
    5: ['ตอบเร็วมาก ทันใจ'],
  },
  DocumentAccessScore: {
    1: ['หาเอกสารไม่เจอเลย', 'ลิงก์เอกสารไม่ชัดเจน/เข้าถึงยาก'],
    2: ['หาเอกสารค่อนข้างยาก', 'อยากให้จัดหมวดหมู่เอกสารให้ชัดเจนขึ้น'],
    3: ['พอหาเอกสารได้ แต่ยังไม่สะดวกมาก', 'เอกสารมี แต่ต้องกดหลายขั้นตอน'],
    4: ['เอกสารหาได้ค่อนข้างง่าย', 'การเข้าถึงเอกสารโดยรวมโอเค'],
    5: ['หาเอกสารง่ายมาก เข้าถึงสะดวก'],
  },
  ServiceQualityScore: {
    1: ['การช่วยเหลือยังไม่ดีเท่าที่ควร', 'ไม่ค่อยช่วยแก้ปัญหาได้'],
    2: ['การช่วยเหลือยังไม่ค่อยประทับใจ', 'อยากให้บริการดีกว่านี้'],
    3: ['บริการพอใช้ได้', 'ช่วยได้ระดับหนึ่ง'],
    4: ['บริการดีโดยรวม', 'ช่วยเหลือได้ค่อนข้างดี'],
    5: ['เจ้าหน้าที่ให้บริการดีมาก', 'บริการดีมาก ประทับใจ'],
  },
  ChannelUsabilityScore: {
    1: ['ใช้งานยาก/สับสน', 'หน้าจอใช้งานไม่ค่อยเข้าใจ'],
    2: ['ยังใช้งานไม่ค่อยสะดวก', 'อยากให้ปรับ UI ให้ใช้ง่ายขึ้น'],
    3: ['ใช้งานได้ แต่ยังมีบางจุดงง ๆ', 'พอใช้ได้แต่ยังไม่ลื่น'],
    4: ['ใช้งานค่อนข้างสะดวก', 'UI โดยรวมโอเค'],
    5: ['ระบบใช้งานสะดวกมาก', 'ใช้งานง่ายมาก'],
  },
}

type FeedbackScores = {
  DataAccuracyScore: number
  ResponseTimeScore: number
  DocumentAccessScore: number
  ServiceQualityScore: number
  ChannelUsabilityScore: number
}

function pickFeedbackComment(scores: FeedbackScores) {
  const entries = Object.entries(scores) as Array<[keyof FeedbackScores, number]>
  const minScore = Math.min(...entries.map(([, v]) => v))

  // ถ้าคะแนนรวมดีมาก ให้คอมเมนต์เชิงบวก
  if (minScore >= 4) {
    const candidates = [
      ...FeedbackCommentByScore.DataAccuracyScore[5],
      ...FeedbackCommentByScore.ResponseTimeScore[5],
      ...FeedbackCommentByScore.DocumentAccessScore[5],
      ...FeedbackCommentByScore.ServiceQualityScore[5],
      ...FeedbackCommentByScore.ChannelUsabilityScore[5],
    ]
    return faker.helpers.arrayElement(candidates)
  }

  // สร้างคอมเมนต์แบบ "รวมหลายด้าน" (ขึ้นบรรทัดใหม่)
  // เลือกด้านที่ได้คะแนนต่ำสุดก่อน และถ้ายังมีด้านที่คะแนนต่ำมาก (<=2) ให้รวมเพิ่ม
  const sorted = [...entries].sort((a, b) => a[1] - b[1])
  const worstScore = sorted[0]?.[1] ?? 3

  const pickedDims: Array<keyof FeedbackScores> = []
  for (const [k, v] of sorted) {
    if (pickedDims.length >= 3) break
    if (v === worstScore || v <= 2) pickedDims.push(k)
  }

  const lines = pickedDims.map((dim) => {
    const score = scores[dim]
    const pool =
      dim === 'DataAccuracyScore' ? FeedbackCommentByScore.DataAccuracyScore[score as 1 | 2 | 3 | 4 | 5] :
        dim === 'ResponseTimeScore' ? FeedbackCommentByScore.ResponseTimeScore[score as 1 | 2 | 3 | 4 | 5] :
          dim === 'DocumentAccessScore' ? FeedbackCommentByScore.DocumentAccessScore[score as 1 | 2 | 3 | 4 | 5] :
            dim === 'ServiceQualityScore' ? FeedbackCommentByScore.ServiceQualityScore[score as 1 | 2 | 3 | 4 | 5] :
              FeedbackCommentByScore.ChannelUsabilityScore[score as 1 | 2 | 3 | 4 | 5]
    return faker.helpers.arrayElement(pool)
  })

  // ถ้ามีหลายบรรทัด ให้บรรทัดสุดท้ายขึ้นต้นด้วย "และ"
  if (lines.length > 1) {
    lines[lines.length - 1] = `และ ${lines[lines.length - 1]}`
  }

  return lines.join(' ')
}

type StaffSeed = {
  name: string
  staffType: StaffType
  jobTitle?: string
  gender?: Gender
  degree?: Degree
}

const STAFF_LIST: StaffSeed[] = [

  // =========================
  // อาจารย์
  // =========================

  { name: "รศ.ดร.วรพจน์ กรีสุระเดช", staffType: StaffType.ACADEMIC, jobTitle: "คณบดีคณะเทคโนโลยีสารสนเทศ", gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.โอฬาร วงศ์วิรัตน์", staffType: StaffType.ACADEMIC, jobTitle: "รองคณบดี", gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "รศ.ดร.กันต์พงษ์ วรรัตน์ปัญญา", staffType: StaffType.ACADEMIC, jobTitle: "รองคณบดี", gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ศ.ดร.กิติ์สุชาต พสุภา", staffType: StaffType.ACADEMIC, jobTitle: "รองคณบดี", gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.กมล วสะภิญโญกุล", staffType: StaffType.ACADEMIC, jobTitle: "รองคณบดี", gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.พัฒนพงษ์ ฉันทมิตรโอภาส", staffType: StaffType.ACADEMIC, jobTitle: "ประธานสาขาวิชา", gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.สุพัณณดา โชติพันธ์", staffType: StaffType.ACADEMIC, jobTitle: "ผู้ช่วยคณบดี", gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.อนันตพัฒน์ อนันตชัย", staffType: StaffType.ACADEMIC, jobTitle: "ผู้ช่วยคณบดี", gender: Gender.FEMALE, degree: Degree.DOCTOR },
  { name: "อาจารย์วารุนี บัววิรัตน์", staffType: StaffType.ACADEMIC, jobTitle: "ผู้ช่วยคณบดี", gender: Gender.FEMALE, degree: Degree.MASTER },
  { name: "ดร.อิสสระพงศ์ ค้วนเครือ", staffType: StaffType.ACADEMIC, jobTitle: "รักษาการแทนหัวหน้าศูนย์ความเป็นเลิศทางเทคโนโลยีเชิงลึก", gender: Gender.MALE, degree: Degree.DOCTOR },

  { name: "รศ.ดร.นพพร โชติกกำธร", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.อัครินทร์ คุณกิตติ", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ศ.ดร.อาริต ธรรมโน", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "รศ.ดร.โชติพัชร์ ภรณวลัย", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.ภัทรชัย ลลิตโรจน์วงศ์", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.สุเมธ ประภาวัต", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.บุญประเสริฐ สุรักษ์รัตนสกุล", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.ลภัส ประดิษฐ์ทัศนีย์", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.สมเกียรติ วังศิริพิทักษ์", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ศ.ดร.สุขสันต์ พาณิชพาพิบูล", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "รศ.ดร.ปานวิทย์ ธุวะนุติ", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ดร.สุภวรรณ ทัศนประเสริฐ", staffType: StaffType.ACADEMIC, gender: Gender.FEMALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.สุภกิจ นุตยะสกุล", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.มานพ พันธ์โคกกรวด", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.กนกวรรณ อัจฉริยะชาญวณิช", staffType: StaffType.ACADEMIC, gender: Gender.FEMALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.สิริอร วิทยากร", staffType: StaffType.ACADEMIC, gender: Gender.FEMALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.พรสุรีย์ แจ่มศรี", staffType: StaffType.ACADEMIC, gender: Gender.FEMALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.สามารถ หมุดและ", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.ธราวิเชษฐ์ ธิติจรูญโรจน์", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.นนท์ คนึงสุขเกษม", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.ประพันธ์ ปวรางกูร", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ดร.ศิรสิทธิ์ โล่ห์ชนะจิต", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.ทัศนัย พลอยสุวรรณ", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ดร.ณัฏฐ์ ดิลกธนากุล", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ผศ.ดร.สุวิทย์ ภูมิฤทธิกุล", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ดร.ภัทรภร วัฒนาชีพ", staffType: StaffType.ACADEMIC, gender: Gender.FEMALE, degree: Degree.DOCTOR },
  { name: "รศ.ดร.บุญเลิศ วัจจะตรากุล", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ดร.ปาณิตา ธูสรานนท์", staffType: StaffType.ACADEMIC, gender: Gender.FEMALE, degree: Degree.DOCTOR },
  { name: "ดร.ศรายุทธ นนท์ศิริ", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "นายเฉลิมพล ศิริกายน", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.MASTER },
  { name: "ดร.ธนานพ ทองถาวร", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },
  { name: "ดร.สิทธิไกร ฉ.โรจน์ประเสริฐ", staffType: StaffType.ACADEMIC, gender: Gender.MALE, degree: Degree.DOCTOR },


  // =========================
  // เจ้าหน้าที่
  // =========================

  { name: "นางสาวณิศวรา จันทร์เพ็ชร", staffType: StaffType.SUPPORT, jobTitle: "รักษาการแทนผู้อำนวยการส่วนสนับสนุนวิชาการ", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาวพิจิตรา สุวรรณศรี", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการเงินและบัญชี", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาววิภาวรรณ มาลัย", staffType: StaffType.SUPPORT, jobTitle: "เจ้าหน้าที่บริหารงานทั่วไป", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาวจิดาภา เผ่าแย้มทวีป", staffType: StaffType.SUPPORT, jobTitle: "เจ้าหน้าที่บริหารงานทั่วไป", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "ว่าที่ ร.ต. อภิชาต ฉายะรถี", staffType: StaffType.SUPPORT, jobTitle: "เจ้าหน้าที่บริหารงานทั่วไป", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นายเฉลิมเกียรติ พวงมาลัย", staffType: StaffType.SUPPORT, jobTitle: "พนักงานขับรถยนต์", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นายจิรายุ ชมภูนุช", staffType: StaffType.SUPPORT, jobTitle: "เจ้าหน้าที่บริหารงานทั่วไป", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นายพัลลภ จ้อยรักษา", staffType: StaffType.SUPPORT, jobTitle: "เจ้าหน้าที่บริหารงานทั่วไป", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นางวัชรวรรณ นิวิฐจรรยงค์", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการพัสดุ", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาวสุมารินทร์ ภู่ขำ", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการพัสดุ", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาวอภิญญา ปิ่นเงิน", staffType: StaffType.SUPPORT, jobTitle: "นักวิเคราะห์นโยบายและแผน", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาวรุ่งทิวา กิจเจริญ", staffType: StaffType.SUPPORT, jobTitle: "นักวิเคราะห์นโยบายและแผน", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาววิภาดา ศิลา", staffType: StaffType.SUPPORT, jobTitle: "นักบริหารทรัพยากรบุคคล", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาวณัฐนรี เลิศไพรัตน์", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการศึกษา", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นายณัฐวุฒิ คุมภะสาโน", staffType: StaffType.SUPPORT, jobTitle: "นักประชาสัมพันธ์", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นายประยงค์ สูตถิพันธ์", staffType: StaffType.SUPPORT, jobTitle: "นักประชาสัมพันธ์", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นางสาวรัตนา วรผลึก", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการศึกษา", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นายมนตรี กิ่งแก้ว", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการคอมพิวเตอร์", gender: Gender.MALE, degree: Degree.MASTER },
  { name: "จ.ส.อ.ธนบดี ข่ายม่าน", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการคอมพิวเตอร์", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นายสมพงษ์ แสนชา", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการคอมพิวเตอร์", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นางสาวกมนนัทธ์ ชื้นสกุล", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการศึกษา", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาววิชญดา วรกาญจนานนท์", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการศึกษา", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาวอัจฉราภรณ์ เดือนกลาง", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการศึกษา", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นายชลปาณัสม์ กิมาพร", staffType: StaffType.SUPPORT, jobTitle: "เจ้าหน้าที่บริหารงานทั่วไป", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นางสาวณัฐชา พ่วงทอง", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการศึกษา", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาวนุชรี ดำชมทรัพย์", staffType: StaffType.SUPPORT, jobTitle: "เจ้าหน้าที่บริหารงานทั่วไป", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นายธนัชเจตน์ บุญเชิด", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการศึกษา", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นางสาวอาบีเกล ศรีชัย", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการศึกษา", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นางสาวฐานมาศ อ่อนสนิท", staffType: StaffType.SUPPORT, jobTitle: "นักวิชาการคอมพิวเตอร์", gender: Gender.FEMALE, degree: Degree.BACHELOR },
  { name: "นายศิรัญญา พวงดี", staffType: StaffType.SUPPORT, jobTitle: "นักพัฒนาซอฟต์แวร์", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นายสรณฺสิริ หอมหวล", staffType: StaffType.SUPPORT, jobTitle: "วิศวกรซอฟต์แวร์", gender: Gender.MALE, degree: Degree.BACHELOR },
  { name: "นายเสนีย์ เพ็ชรสุขุม", staffType: StaffType.SUPPORT, jobTitle: "วิศวกรซอฟต์แวร์", gender: Gender.MALE, degree: Degree.BACHELOR },
  // เพิ่มเติมสำหรับวิศวกรซอฟต์แวร์ที่เหลือจากรายการ format
  // { name: "นายปัณณวิชญ์ อริยธนะกตวงศ์", staffType: StaffType.SUPPORT, jobTitle: "วิศวกรซอฟต์แวร์" }

]

async function main() {
  console.log('Start Seeding...')
  // const password = await bcrypt.hash('password123', 10)

  // ---------------- RESET ----------------
  // Note: Preserving Messages, Conversations, FAQs, StaticQAs, DirectContact_Requests
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "Feedbacks",
      "TrainingParticipants",
      "TrainingEvents",
      "Resignations",
      "Employees",
      "LineFriends"
    CASCADE;
  `)

  // ==========================================================
  // ROYAL DECORATIONS
  // ==========================================================
  await prisma.royalDecorations.createMany({
    data: [
      { Name: "เหรียญเงินมงกุฎไทย", Abbreviation: "ร.ง.ม.", Level: "ชั้นที่ 7", Type: "MEDAL" },
      { Name: "เหรียญเงินช้างเผือก", Abbreviation: "ร.ง.ช.", Level: "ชั้นที่ 7", Type: "MEDAL" },
      { Name: "เหรียญทองมงกุฎไทย", Abbreviation: "ร.ท.ม.", Level: "ชั้นที่ 6", Type: "MEDAL" },
      { Name: "เหรียญทองช้างเผือก", Abbreviation: "ร.ท.ช.", Level: "ชั้นที่ 6", Type: "MEDAL" },
      { Name: "เบญจมาภรณ์มงกุฎไทย", Abbreviation: "บ.ม.", Level: "ชั้นที่ 5", Type: "BELOW_SASH" },
      { Name: "เบญจมาภรณ์ช้างเผือก", Abbreviation: "บ.ช.", Level: "ชั้นที่ 5", Type: "BELOW_SASH" },
      { Name: "จัตุรถาภรณ์มงกุฎไทย", Abbreviation: "จ.ม.", Level: "ชั้นที่ 4", Type: "BELOW_SASH" },
      { Name: "จัตุรถาภรณ์ช้างเผือก", Abbreviation: "จ.ช.", Level: "ชั้นที่ 4", Type: "BELOW_SASH" },
      { Name: "ตริตาภรณ์มงกุฎไทย", Abbreviation: "ต.ม.", Level: "ชั้นที่ 3", Type: "BELOW_SASH" },
      { Name: "ตริตาภรณ์ช้างเผือก", Abbreviation: "ต.ช.", Level: "ชั้นที่ 3", Type: "BELOW_SASH" },
      { Name: "ทวีติยาภรณ์มงกุฎไทย", Abbreviation: "ท.ม.", Level: "ชั้นที่ 2", Type: "SASH" },
      { Name: "ทวีติยาภรณ์ช้างเผือก", Abbreviation: "ท.ช.", Level: "ชั้นที่ 2", Type: "SASH" },
      { Name: "ประถมาภรณ์มงกุฎไทย", Abbreviation: "ป.ม.", Level: "ชั้นที่ 1", Type: "SASH" },
      { Name: "ประถมาภรณ์ช้างเผือก", Abbreviation: "ป.ช.", Level: "ชั้นที่ 1", Type: "SASH" },
      { Name: "มหาวชิรมงกุฎ", Abbreviation: "ม.ว.ม.", Level: "ชั้นสูงสุด", Type: "SASH" },
      { Name: "มหาปรมาภรณ์ช้างเผือก", Abbreviation: "ม.ป.ช.", Level: "ชั้นสูงสุด", Type: "SASH" },
      { Name: "เหรียญจักรพรรดิมาลา", Abbreviation: "ร.จ.พ.", Level: null, Type: "MEDAL" }
    ],
    skipDuplicates: true
  })

  // ==========================================================
  // EMPLOYEES
  // ==========================================================
  const employees: any[] = []
  // const academicJobTitles = ["อาจารย์", "อาจารย์ (หัวหน้าภาควิชา)", "อาจารย์ (รองคณบดี)", "อาจารย์ (ผู้อำนวยการศูนย์)"];
  const supportJobTitles = [
    "นักวิชาการคอมพิวเตอร์",
    "นักวิชาการเงินและบัญชี",
    "นักวิชาการพัสดุ",
    "เจ้าหน้าที่บริหารงานทั่วไป",
    "นักวิเคราะห์นโยบายและแผน",
    "นายช่างเทคนิค"
  ];

  for (let i = 0; i < STAFF_LIST.length; i++) {
    const staff = STAFF_LIST[i];
    const staffType = staff.staffType;

    const birthDate = faker.date.birthdate({ min: 33, max: 60, mode: 'age' });
    const gender =
      staff.gender ??
      faker.helpers.weightedArrayElement([
        { weight: 7, value: Gender.MALE },
        { weight: 3, value: Gender.FEMALE },
      ]);
    const degree =
      staff.degree ??
      (staffType === StaffType.ACADEMIC
        ? Degree.DOCTOR
        : Degree.BACHELOR);
    // const fullName = faker.person.fullName();
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    const letter = alphabet[i % alphabet.length];
    const round = Math.floor(i / alphabet.length) + 1;
    const email = `${letter}${letter}${round}@gmail.com`;
    const startDate = faker.date.past({ years: 20 })
    const emp = await prisma.employees.create({
      data: {
        FullName: staff.name,
        BirthDate: birthDate,
        Gender: gender,
        Degree: degree,
        Age: calculateAge(birthDate),
        Email: email,
        Phone: faker.phone.number({ style: 'human' }),
        StaffType: staff.staffType,
        JobTitle:
          staff.jobTitle ??
          (staff.staffType === StaffType.ACADEMIC
            ? "อาจารย์"
            : faker.helpers.arrayElement(supportJobTitles)),

        StartDate: startDate,
        Status: EmployeeStatus.ACTIVE,
        WorkDuration: calculateWorkDuration(startDate),
        PositionNumber: faker.number.int({ min: 1000, max: 9999 })

      }
    });
    employees.push(emp);

    // ==========================================================
    // POSITION
    // ==========================================================

    let academicPosition: AcademicPosition | null = null
    let supportPosition: SupportPosition | null = null

    if (staff.staffType === StaffType.ACADEMIC) {

      const name = emp.FullName

      if (name.startsWith("ศ.")) {
        academicPosition = AcademicPosition.PROFESSOR
      }
      else if (name.startsWith("รศ.")) {
        academicPosition = AcademicPosition.ASSOCIATE_PROFESSOR
      }
      else if (name.startsWith("ผศ.")) {
        academicPosition = AcademicPosition.ASSISTANT_PROFESSOR
      }
      else {
        academicPosition = AcademicPosition.LECTURER
      }

    } else {

      supportPosition = faker.helpers.arrayElement([
        SupportPosition.OPERATIONAL_LEVEL
      ])

    }

    await prisma.positions.create({
      data: {
        EmployeeId: emp.EmployeeId,
        AcademicPosition: academicPosition,
        SupportPosition: supportPosition,
        StartDate: startDate,
        EndDate: null
      }
    })


    let employmentType: EmploymentType

    if (staff.staffType === StaffType.ACADEMIC) {
      employmentType = EmploymentType.GOVERNMENT
    } else {
      employmentType = faker.helpers.arrayElement([
        EmploymentType.BUDGET,
        EmploymentType.INCOME,
        EmploymentType.SPECIAL
      ])
    }
    await prisma.employments.create({
      data: {
        EmployeeId: emp.EmployeeId,
        EmploymentType: employmentType,
        StartDate: startDate
      }
    })



    if (staff.staffType === StaffType.SUPPORT) {

      const contractStage = faker.helpers.weightedArrayElement([
        { weight: 20, value: "PROBATION" },
        { weight: 80, value: "CONTRACT" }
      ])

      // =========================
      // PROBATION (20%)
      // =========================
      if (contractStage === "PROBATION") {

        const probationEnd = new Date(startDate)
        probationEnd.setMonth(probationEnd.getMonth() + 6)

        await prisma.employeeContracts.create({
          data: {
            EmployeeId: emp.EmployeeId,
            ContractType: ContractType.PROBATION,
            ContractRound: 0,
            StartDate: startDate,
            EndDate: probationEnd
          }
        })
      }

      // =========================
      // CONTRACT (80%)
      // =========================
      else {

        const round = faker.number.int({ min: 15, max: 30 })

        let contractStart = new Date(startDate)

        for (let i = 1; i <= round; i++) {

          const contractEnd = new Date(contractStart)
          contractEnd.setFullYear(contractEnd.getFullYear() + 2)

          await prisma.employeeContracts.create({
            data: {
              EmployeeId: emp.EmployeeId,
              ContractType: ContractType.EMPLOYMENT,
              ContractRound: i,
              StartDate: contractStart,
              EndDate: contractEnd
            }
          })

          contractStart = contractEnd
        }
      }
    }


  }

  // ==========================================================
  // ทดสอบแจ้งเตือนเกษียณอายุ (สายวิชาการ) — วันเกิดคำนวณให้เกษียณ 30 ก.ย. ตามกฎเดียวกับระบบ
  // ==========================================================
  {
    const { retireYear, inTwoMonthWindow } = pickRetirementYearForNotificationTest()
    const birthRetireTest = birthDateForRetirementSept30SameYear(retireYear)
    const startDateRetire = new Date(birthRetireTest.getFullYear() + 22, 5, 1)

    console.log(
      `[seed] บุคลากรทดสอบเกษียณ: เกษียณ 30 ก.ย. ${retireYear} · ${inTwoMonthWindow ? "อยู่ในช่วงแจ้งเตือน ~2 เดือน (กระดิ่ง/เมล)" : "นอกช่วง 2 เดือน — เทสหน้าแก้ไขได้; กระดิ่งช่วงส.ค.–ก.ย. ของปีนั้น"}`
    )

    const empRetire = await prisma.employees.create({
      data: {
        FullName: 'รศ.ดร.ทดสอบ เกษียญอายุ (seed)',
        BirthDate: birthRetireTest,
        Gender: Gender.MALE,
        Degree: Degree.DOCTOR,
        DegreeDetail: '',
        Age: calculateAge(birthRetireTest),
        Email: 'retire_test@kmitl.ac.th',
        Phone: '081-000-0999',
        StaffType: StaffType.ACADEMIC,
        JobTitle: 'รองศาสตราจารย์',
        StartDate: startDateRetire,
        Status: EmployeeStatus.ACTIVE,
        WorkDuration: calculateWorkDuration(startDateRetire),
        PositionNumber: 9999,
      },
    })
    employees.push(empRetire)

    await prisma.positions.create({
      data: {
        EmployeeId: empRetire.EmployeeId,
        AcademicPosition: AcademicPosition.ASSOCIATE_PROFESSOR,
        SupportPosition: null,
        StartDate: startDateRetire,
        EndDate: null,
        AcademicRetirementNotifiedHR: false,
        AcademicRetirementReadByHR: false,
      },
    })

    await prisma.employments.create({
      data: {
        EmployeeId: empRetire.EmployeeId,
        EmploymentType: EmploymentType.GOVERNMENT,
        StartDate: startDateRetire,
      },
    })
  }

  // ==========================================================
  // ADMINISTRATIVE POSITIONS
  // ==========================================================


  for (const staff of STAFF_LIST) {

    if (!staff.jobTitle) continue

    const emp = employees.find(
      e => e.FullName.trim() === staff.name.trim()
    )

    if (!emp) continue

    const startDate = faker.date.past({ years: 3 })

    await prisma.employeeAdministrativePositions.create({
      data: {
        EmployeeId: emp.EmployeeId,
        PositionName: staff.jobTitle,
        StartDate: startDate,
        EndDate: null
      }
    })
  }

  // ==========================================================
  // RESIGNATIONS
  // ==========================================================

  // function calculateRetirementDate(birthDate: Date) {
  //   const retireYear = birthDate.getFullYear() + 60
  //   return new Date(retireYear, 8, 30) // 30 September
  // }

  // const today = new Date()

  // const resignPattern: Record<number, number> = {
  //   2565: 2,
  //   2566: 2,
  //   2567: 3,
  //   2568: 2
  // }

  // // เหตุผลสำหรับ SUPPORT
  // const supportResignReasons = [
  //   ResignReason.PERSONAL_BUSINESS,
  //   ResignReason.HEALTH,
  //   ResignReason.STUDY,
  //   ResignReason.NEW_JOB,
  //   ResignReason.END_OF_CONTRACT,
  //   ResignReason.NON_RENEWAL,
  //   ResignReason.OTHER
  // ]

  // // ==========================================================
  // // SUPPORT STAFF
  // // ==========================================================

  // for (const year of Object.keys(resignPattern).map(Number)) {

  //   for (let i = 0; i < resignPattern[year]; i++) {

  //     const activeEmployees = employees.filter(
  //       e =>
  //         e.Status === EmployeeStatus.ACTIVE &&
  //         e.StaffType === StaffType.SUPPORT
  //     )

  //     if (activeEmployees.length === 0) break

  //     const emp = faker.helpers.arrayElement(activeEmployees)
  //     const reason = faker.helpers.arrayElement(supportResignReasons)

  //     let resignDate: Date

  //     // กรณีหมดสัญญา
  //     if (
  //       reason === ResignReason.END_OF_CONTRACT ||
  //       reason === ResignReason.NON_RENEWAL
  //     ) {

  //       const contract = await prisma.employeeContracts.findFirst({
  //         where: {
  //           EmployeeId: emp.EmployeeId,
  //           IsActive: true
  //         }
  //       })

  //       if (!contract) continue

  //       resignDate = contract.EndDate

  //       await prisma.employeeContracts.update({
  //         where: { ContractId: contract.ContractId },
  //         data: { IsActive: false }
  //       })

  //     } else {

  //       resignDate = randomDateInYearBE(year)

  //       // ป้องกันวันที่ลาออกก่อนเริ่มงาน
  //       if (resignDate < emp.StartDate) continue
  //     }

  //     await prisma.resignations.create({
  //       data: {
  //         EmployeeId: emp.EmployeeId,
  //         ResignDate: resignDate,
  //         Reason: reason,
  //         WorkingYears:
  //           (resignDate.getTime() - emp.StartDate.getTime()) /
  //           (1000 * 60 * 60 * 24 * 365)
  //       }
  //     })

  //     // เปลี่ยนสถานะเมื่อถึงวันลาออก
  //     if (resignDate <= today) {

  //       await prisma.employees.update({
  //         where: { EmployeeId: emp.EmployeeId },
  //         data: { Status: EmployeeStatus.RESIGNED }
  //       })

  //       emp.Status = EmployeeStatus.RESIGNED
  //     }
  //   }
  // }

  // // ==========================================================
  // // ACADEMIC STAFF (RETIREMENT ONLY)
  // // ==========================================================

  // const academicEmployees = employees.filter(
  //   e => e.StaffType === StaffType.ACADEMIC
  // )

  // for (const emp of academicEmployees) {

  //   const retireDate = calculateRetirementDate(emp.BirthDate)

  //   // ถ้ายังไม่ถึงวันเกษียณ ไม่ต้องสร้าง record
  //   if (retireDate > today) continue

  //   await prisma.resignations.create({
  //     data: {
  //       EmployeeId: emp.EmployeeId,
  //       ResignDate: retireDate,
  //       Reason: ResignReason.RETIREMENT,
  //       WorkingYears:
  //         (retireDate.getTime() - emp.StartDate.getTime()) /
  //         (1000 * 60 * 60 * 24 * 365)
  //     }
  //   })

  //   await prisma.employees.update({
  //     where: { EmployeeId: emp.EmployeeId },
  //     data: { Status: EmployeeStatus.RESIGNED }
  //   })
  // }



  await seedEmployeeDecorations()
  // ==========================================================
  // USERS (HR)
  // ==========================================================
  // for (let i = 0; i < 5; i++) {
  //   const emp = employees.filter(e => e.Status === EmployeeStatus.ACTIVE)[i];
  //   const user = await prisma.users.create({
  //     data: {
  //       Name: emp.FullName,
  //       Username: `hr${i + 1}`,
  //       Password: password,
  //       Email: faker.internet.email(),
  //       Role: faker.helpers.arrayElement([UserRole.ADMIN, UserRole.STAFF]),
  //       Title: faker.helpers.arrayElement([Usertitle.MR, Usertitle.MRS, Usertitle.MISS]),
  //       Phone: faker.phone.number()
  //     }
  //   })
  //   await prisma.employees.update({
  //     where: { EmployeeId: emp.EmployeeId },
  //     data: { UserId: user.UserId }
  //   })
  // }

  // const hrUsers = await prisma.users.findMany()

  // ==========================================================
  // LINE FRIENDS
  // ==========================================================
  const lineFriends: any[] = []
  for (let i = 0; i < 50; i++) {
    const friend = await prisma.lineFriends.create({
      data: {
        LineUserId: faker.string.uuid(),
        DisplayName: faker.person.firstName(),
        CreatedAt: faker.date.past({ years: 2 })
      }
    })
    lineFriends.push(friend)
  }

  // ==========================================================
  // 4. CONVERSATIONS (BOT vs STAFF)
  // ==========================================================

  // for (const year of YEARS) {
  //   let botVolume = 0;
  //   let staffVolume = 0;
  //   if (year <= 2566) {
  //     botVolume = 0; staffVolume = 70;
  //   } else if (year === 2567) {
  //     botVolume = 40; staffVolume = 50;
  //   } else {
  //     botVolume = 150; staffVolume = 15;
  //   }
  //   for (let i = 0; i < staffVolume; i++) {
  //     const friend = faker.helpers.arrayElement(lineFriends);
  //     const createdAt = randomDateInYearBE(year);
  //     const hrAgent = faker.helpers.arrayElement(hrUsers);

  //     // 1. สร้าง Request ก่อน
  //     const request = await prisma.directContact_Requests.create({
  //       data: {
  //         LineUserId: friend.LineUserId,
  //         DisplayName: friend.DisplayName,
  //         Request: faker.helpers.arrayElement(Requests),
  //         CreatedAt: createdAt,
  //         Status: DirectContact_Request_Status.ACCEPTED,
  //         UserId: hrAgent.UserId,
  //         requestCount: 1
  //       }
  //     });

  //     // 2. สร้าง Conversation เชื่อมกับ Request
  //     const conversation = await prisma.conversations.create({
  //       data: {
  //         LineUserId: friend.LineUserId,
  //         UserId: hrAgent.UserId,
  //         DirectContactRequestId: request.DirectContactRequestId,
  //         Type: ConversationType.STAFF,
  //         Status: ConversationStatus.CLOSED,
  //         Channel: ConversationChannel.LINE,
  //         CreatedAt: createdAt,
  //         EndedAt: new Date(createdAt.getTime() + 3600000)
  //       }
  //     });

  //     const staffResponseTime = faker.number.int({ min: 200, max: 360 }); // 10-60 นาที
  //     await prisma.messages.create({
  //       data: {
  //         ConversationId: conversation.ConversationId,
  //         Role: MessageRole.assistant,
  //         Content: 'สวัสดีค่ะ เจ้าหน้าที่รับเรื่องแล้วนะคะ กำลังตรวจสอบให้ค่ะ',
  //         ResponseTimeSeconds: staffResponseTime,
  //         CreatedAt: new Date(createdAt.getTime() + staffResponseTime * 100)
  //       }
  //     });
  //   }

  //   // คุยกับบอตโดยตรง ไม่ผ่าน DirectContact_Requests
  //   for (let i = 0; i < botVolume; i++) {
  //     const friend = faker.helpers.arrayElement(lineFriends);
  //     const createdAt = randomDateInYearBE(year);

  //     const conversation = await prisma.conversations.create({
  //       data: {
  //         LineUserId: friend.LineUserId,
  //         Type: ConversationType.BOT,
  //         Status: ConversationStatus.CLOSED,
  //         Channel: ConversationChannel.LINE,
  //         CreatedAt: createdAt,
  //         EndedAt: new Date(createdAt.getTime() + 60000)
  //       }
  //     });

  //     // ข้อความของบอต (Response Time จะเร็ว)
  //     await prisma.messages.create({
  //       data: {
  //         ConversationId: conversation.ConversationId,
  //         Role: MessageRole.system,
  //         Content: 'สวัสดีค่ะ ฉันคือแชตบอต HR มีอะไรให้ช่วยไหมคะ?',
  //         ResponseTimeSeconds: faker.number.float({ min: 0.5, max: 2.5 }), // 0.5-2.5 วินาที
  //         CreatedAt: createdAt
  //       }
  //     });
  //   }
  // }

  // ==========================================================
  // FEEDBACK 
  // ==========================================================

  for (const year of YEARS) {
    for (let i = 0; i < 50; i++) {
      let rating = 3;

      if (year <= 2566) {
        rating = faker.number.int({ min: 1, max: 4 });
      }
      else if (year === 2567) {
        rating = faker.number.int({ min: 1, max: 3 });
      }
      else if (year === 2568 || year === 2569) {
        rating = faker.number.int({ min: 1, max: 5 });
      }

      const scores: FeedbackScores = {
        DataAccuracyScore: faker.number.int({ min: 1, max: 5 }),
        ResponseTimeScore: faker.number.int({ min: 1, max: 5 }),
        DocumentAccessScore: faker.number.int({ min: 1, max: 5 }),
        ServiceQualityScore: faker.number.int({ min: 1, max: 5 }),
        ChannelUsabilityScore: faker.number.int({ min: 1, max: 5 }),
      }

      // Ensure at least one "score = 1" exists for each year 2566–2569
      if (year >= 2566 && year <= 2569 && i === 0) {
        const dim = faker.helpers.arrayElement([
          'DataAccuracyScore',
          'ResponseTimeScore',
          'DocumentAccessScore',
          'ServiceQualityScore',
          'ChannelUsabilityScore',
        ] as const)
        scores[dim] = 1
      }

      await prisma.feedbacks.create({
        data: {
          LineUserId: faker.helpers.maybe(() => faker.helpers.arrayElement(lineFriends).LineUserId, { probability: 0.7 }),
          Rating: rating,
          ...scores,
          Comment: pickFeedbackComment(scores),
          Source: FeedbackSource.LINE,
          CreatedAt: randomDateInYearBE(year)
        }
      });
    }
  }

  // ==========================================================
  // FAQ & STATIC QA
  // ==========================================================
  // Create all FAQ categories to match constants
  await prisma.fAQCategories.createMany({
    data: [
      { Name: 'คำถามทั่วไป' },
      { Name: 'การใช้งานแชตบอต' },
      { Name: 'กฎระเบียบ' },
      { Name: 'สิทธิการลา' },
      { Name: 'เอกสารและการร้องขอ' },
      { Name: 'การประกาศและข่าวสาร' },
      { Name: 'อื่นๆ' }
    ],
    skipDuplicates: true
  });

  // const category = await prisma.fAQCategories.findFirst({ where: { Name: 'คำถามทั่วไป' } });
  // await prisma.fAQs.createMany({
  //   data: [
  //     { Question: 'สามารถลาพักร้อนได้กี่วัน', Answer: 'สามารถลาพักร้อนได้ตามสิทธิประจำปี', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'ติดต่อฝ่าย HR อย่างไร', Answer: 'สามารถติดต่อผ่าน LINE OA หรือโทรภายใน', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'การเบิกค่าอบรมทำอย่างไร', Answer: 'กรอกแบบฟอร์มออนไลน์และแนบเอกสาร', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'ขั้นตอนต่อสัญญาจ้าง', Answer: 'ยื่นเอกสารก่อนหมดสัญญาอย่างน้อย 30 วัน', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'การเบิกค่าใช้จ่าย', Answer: 'กรอกแบบฟอร์มออนไลน์และแนบเอกสาร', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'ขั้นตอนการขออนุมัติ', Answer: 'ยื่นเอกสารก่อนหมดสัญญาอย่างน้อย 30 วัน', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'การเบิกค่าใช้จ่าย', Answer: 'กรอกแบบฟอร์มออนไลน์และแนบเอกสาร', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'ขั้นตอนการขออนุมัติ', Answer: 'ยื่นเอกสารก่อนหมดสัญญาอย่างน้อย 30 วัน', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'การเบิกค่าใช้จ่าย', Answer: 'กรอกแบบฟอร์มออนไลน์และแนบเอกสาร', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'ขั้นตอนการขออนุมัติ', Answer: 'ยื่นเอกสารก่อนหมดสัญญาอย่างน้อย 30 วัน', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'การเบิกค่าใช้จ่าย', Answer: 'กรอกแบบฟอร์มออนไลน์และแนบเอกสาร', CategoryId: category?.FAQCategoryId || null },
  //     { Question: 'ขั้นตอนการขออนุมัติ', Answer: 'ยื่นเอกสารก่อนหมดสัญญาอย่างน้อย 30 วัน', CategoryId: category?.FAQCategoryId || null }
  //   ]
  // });
  // await prisma.staticQAs.createMany({
  //   data: [
  //     { Question: 'การเบิกค่าอบรมทำอย่างไร', Answer: 'กรอกแบบฟอร์มออนไลน์และแนบเอกสาร' },
  //     { Question: 'ขั้นตอนต่อสัญญาจ้าง', Answer: 'ยื่นเอกสารก่อนหมดสัญญาอย่างน้อย 30 วัน' }
  //   ]
  // });

  // ==========================================================
  // TRAINING
  // ==========================================================
  const TrainingTopics = [
    { title: 'สัมมนาวิชาการระดับนานาชาติ ICITEE', category: TrainingCategory.CONFERENCE, domain: TrainingDomain.ACADEMIC },
    { title: 'การใช้งานระบบเอกสารอิเล็กทรอนิกส์ (e-Document)', category: TrainingCategory.TRAINING, domain: TrainingDomain.COMPLIANCE },
    { title: 'การเสริมสร้างความเข้าใจเกณฑ์ประกันคุณภาพการศึกษา AUN-QA', category: TrainingCategory.SEMINAR, domain: TrainingDomain.COMPLIANCE },
    { title: 'การนำเสนอผลงานวิจัยในวารสารระดับนานาชาติ (SJR Q1)', category: TrainingCategory.CONFERENCE, domain: TrainingDomain.ACADEMIC },
    { title: 'อบรมทักษะการใช้ Generative AI เพื่อเพิ่มประสิทธิภาพการทำงาน', category: TrainingCategory.TRAINING, domain: TrainingDomain.TECHNICAL },
    { title: 'โครงการพัฒนาศักยภาพบุคลากรสายสนับสนุน: Service Mind & Digital Skills', category: TrainingCategory.TRAINING, domain: TrainingDomain.SOFT_SKILLS },
    { title: 'Cyber Security Awareness: การป้องกันภัยคุกคามทางไซเบอร์', category: TrainingCategory.TRAINING, domain: TrainingDomain.TECHNICAL },
    { title: 'อบรมเทคนิคการเขียนบทความวิจัยและจริยธรรมการวิจัย', category: TrainingCategory.SEMINAR, domain: TrainingDomain.ACADEMIC },
    { title: 'การบริหารโครงการไอทีด้วยกระบวนการ Agile', category: TrainingCategory.TRAINING, domain: TrainingDomain.MANAGEMENT }
  ];

  const FacultyLocations = [
    'ห้องประชุมใหญ่ อาคาร A คณะไอที',
    'ห้อง Lab 304 ชั้น 3 อาคารคณะไอที',
    'ห้องสัมมนา 402 ชั้น 4',
    'อาคารเรียนรวม ชั้น 3 ห้อง 301',
    'ศูนย์นวัตกรรมดิจิทัล'
  ];

  const ProvinceLocations = ['จังหวัดเชียงใหม่', 'จังหวัดขอนแก่น', 'จังหวัดภูเก็ต', 'ชลบุรี (พัทยา)', 'จังหวัดนครราชสีมา'];
  const InternationalLocations = ['ประเทศญี่ปุ่น', 'ประเทศสิงคโปร์', 'สหราชอาณาจักร', 'ประเทศเยอรมนี', 'ประเทศเกาหลีใต้'];
  const OnlineLocations = ['Microsoft Teams', 'Zoom Webinar', 'Google Meet'];

  const getRandomDate = (yearBE: number) => {
    const yearAD = yearBE - 543;
    const start = new Date(yearAD, 0, 1);
    const end = new Date(yearAD, 11, 20);
    return faker.date.between({ from: start, to: end });
  };

  const allEmployeesWithResignInfo = await prisma.employees.findMany({
    include: {
      Resignations: true
    }
  });

  // Global training participation ratio (9:1)
  // 10% ของบุคลากรถูกกำหนดให้ "ไม่เข้าร่วมการอบรมทุกงาน" (ไม่ถูก seed ลง TrainingParticipants เลย)
  const neverParticipantIds = new Set<string>(
    faker.helpers
      .shuffle(allEmployeesWithResignInfo.map((e) => e.EmployeeId))
      .slice(0, Math.max(1, Math.floor(allEmployeesWithResignInfo.length * 0.1)))
  )

  for (const year of YEARS) {
    const trainingCount =
      year === 2568 ? 15 :
        year === 2567 ? 10 :
          year === 2566 ? 8 : 5;

    for (let i = 0; i < trainingCount; i++) {
      const topicData = faker.helpers.arrayElement(TrainingTopics);
      const start = getRandomDate(year);


      const eligibleEmployees = allEmployeesWithResignInfo.filter(emp => {
        if (emp.Resignations.length === 0) return true;
        const resignDate = emp.Resignations[0].ResignDate;
        return start.getTime() < resignDate.getTime();
      });

      const eligibleParticipants = eligibleEmployees.filter(
        (emp) => !neverParticipantIds.has(emp.EmployeeId)
      )

      const locationType = faker.helpers.weightedArrayElement([
        { weight: 5, value: LocationType.FACULTY },
        { weight: 2, value: LocationType.ONLINE },
        { weight: 2, value: LocationType.PROVINCE },
        { weight: 1, value: LocationType.INTERNATIONAL },
      ]);

      let locationName = '';
      let format: TrainingFormat = TrainingFormat.ONSITE;

      if (locationType === LocationType.FACULTY) {
        locationName = faker.helpers.arrayElement(FacultyLocations);
        if (faker.number.int({ min: 1, max: 10 }) > 8) format = TrainingFormat.HYBRID;
      } else if (locationType === LocationType.PROVINCE) {
        locationName = faker.helpers.arrayElement(ProvinceLocations);
      } else if (locationType === LocationType.INTERNATIONAL) {
        locationName = faker.helpers.arrayElement(InternationalLocations);
      } else {
        locationName = faker.helpers.arrayElement(OnlineLocations);
        format = TrainingFormat.ONLINE;
      }

      const pCount = locationType === LocationType.INTERNATIONAL ? faker.number.int({ min: 1, max: 3 }) :
        locationType === LocationType.ONLINE ? faker.number.int({ min: 20, max: 40 }) :
          faker.number.int({ min: 8, max: 15 });

      const actualCount = Math.min(pCount, eligibleParticipants.length);
      const participants = faker.helpers.arrayElements(eligibleParticipants, actualCount);

      let budget = 0;
      if (locationType === LocationType.INTERNATIONAL) {
        budget = participants.length * faker.number.int({ min: 55000, max: 80000 });
      } else if (locationType === LocationType.PROVINCE) {
        budget = participants.length * faker.number.int({ min: 8000, max: 12000 });
      } else if (locationType === LocationType.FACULTY) {
        budget = faker.helpers.arrayElement([0, 2000, 3500, 5000]);
      } else {
        budget = faker.helpers.arrayElement([0, 1500, 3000]);
      }

      const hours = locationType === LocationType.INTERNATIONAL ? faker.number.int({ min: 18, max: 30 }) :
        locationType === LocationType.PROVINCE ? faker.number.int({ min: 12, max: 18 }) :
          faker.number.int({ min: 3, max: 8 });

      const end = new Date(start.getTime() + (Math.ceil(hours / 6) - 1) * 86400000);

      const training = await prisma.trainingEvents.create({
        data: {
          Title: `${topicData.title} (${year})`,
          Category: topicData.category,
          Domain: topicData.domain,
          Description: 'การพัฒนาทักษะวิชาชีพและการบริหารจัดการองค์กร',
          StartDate: start,
          EndDate: end,
          LocationType: locationType,
          LocationName: locationName,
          Organizer: locationType === LocationType.FACULTY ? 'ฝ่ายทรัพยากรบุคคล คณะไอที' : 'หน่วยงานภายนอก',
          Format: format,
          Budget: budget,
          YearBudget: String(year),
          Hours: hours
        }
      });

      if (participants.length > 0) {
        await prisma.trainingParticipants.createMany({
          data: participants.map((emp) => ({
            TrainingEventId: training.TrainingEventId,
            EmployeeId: emp.EmployeeId
          })),
          skipDuplicates: true
        });
      }
    }
  }

  // ---------------- StudentInfo ----------------
  await prisma.studentInfo.deleteMany({
    where: {
      Year: {
        in: ["2564", "2565", "2566", "2567", "2568", "2569"],
      },
    },
  })
  await prisma.studentInfo.createMany({
    data: [
      { Year: "2564", TotalStudent: 330 },
      { Year: "2565", TotalStudent: 260 },
      { Year: "2566", TotalStudent: 215 },
      { Year: "2567", TotalStudent: 180 },
      { Year: "2568", TotalStudent: 220 },
      { Year: "2569", TotalStudent: 250 },
    ],
  })

  await seedDocumentCategoriesAndTags();

  console.log('✅ Seeding Complete!');
}

async function seedDocumentCategoriesAndTags() {
  console.log('🌱 Seeding document categories and tags...')

  const categoriesWithTags = [
    {
      name: "สวัสดิการสถาบันฯ",
      description: "เอกสารเกี่ยวกับสวัสดิการต่างๆ ของสถาบัน",
      tags: [
        "ประกันสุขภาพกลุ่ม",
        "ประกันอุบัติเหตุ",
        "ประกันภัยเดินทางต่างประเทศ",
        "กองทุนสำรองเลี้ยงชีพ",
        "สวัสดิการสินเชื่อ",
        "แบบฟอร์มที่เกี่ยวข้องกับสวัสดิการสถาบันฯ",
        "แบบฟอร์มเกี่ยวกับบ้านพักสถาบัน",
      ],
    },
    {
      name: "แบบฟอร์มเอกสารทั่วไป",
      description: "แบบฟอร์มและเอกสารทั่วไปสำหรับบุคลากร",
      tags: [
        "แบบฟอร์มคำขอทั่วไป",
        "แบบฟอร์มใบรายงานตัวเข้าปฏิบัติงาน",
        "เอกสารสำหรับข้าราชการ",
        "เอกสารสำหรับพนักงานสถาบันฯ",
        "เอกสารสำหรับลูกจ้างประจำ",
        "เอกสารสำหรับลูกจ้างรายเดือนด้วยเงินรายได้",
        "แบบฟอร์มเกี่ยวกับ กสจ",
        "แบบฟอร์มอื่นๆ",
      ],
    },
    {
      name: "การลาประเภทต่างๆ",
      description: "แบบฟอร์มการลาทุกประเภท",
      tags: [
        "แบบฟอร์มใบลาธุระส่วนตัว",
        "แบบฟอร์มใบลาการศึกษา/ฝึกอบรม",
        "แบบฟอร์มใบลาออก",
      ],
    },
    {
      name: "การฝึกอบรม/นำเสนอผลงาน/สัมมนา",
      description: "เอกสารเกี่ยวกับการพัฒนาบุคลากร",
      tags: [
        "การอบรม",
        "การนำเสนอผลงาน",
        "การสัมมนา",
      ],
    },
    {
      name: "การเลื่อนตำแหน่ง/สัญญาจ้าง/ปรับวุฒิการศึกษา",
      description: "เอกสารเกี่ยวกับการพัฒนาตำแหน่งและสัญญาจ้าง",
      tags: [
        "แบบฟอร์มการประเมินเพื่อเปลี่ยนสถานภาพเป็นพนักงานสถาบันฯ",
        "แบบฟอร์มการขอกำหนดตำแหน่งที่สูงขึ้น",
        "แบบประเมินเพื่อต่อสัญญาจ้าง/ประเมินผลการปฏิบัติงาน",
        "แบบประเมินเพื่อเปลี่ยนเงื่อนไขการบรรจุ",
        "แบบฟอร์มสัญญาจ้าง",
      ],
    },
    {
      name: "การขอกำหนดตำแหน่ง",
      description: "เอกสารเกี่ยวกับการขอกำหนดตำแหน่งต่างๆ",
      tags: [
        "การขอกำหนดตำแหน่งทางวิชาการ",
        "การขอกำหนดตำแหน่งสายสนับสนุนวิชาการ",
      ],
    },
    {
      name: "หลักเกณฑ์เกี่ยวกับภาระงาน",
      description: "หลักเกณฑ์และข้อบังคับเกี่ยวกับภาระงาน",
      tags: [
        "สายวิชาการ",
        "สายสนับสนุนวิชาการ",
      ],
    },
    {
      name: "ข้อบังคับเกี่ยวกับการบริหารงานบุคคล",
      description: "ประกาศและข้อบังคับด้านบริหารงานบุคคล",
      tags: [
        "ประกาศที่เกี่ยวข้องกับการบริหารงานบุคคล ปี 2569",
        "ประกาศที่เกี่ยวข้องกับการบริหารงานบุคคล ปี 2568",
        "ประกาศที่เกี่ยวข้องกับการบริหารงานบุคคล ปี 2567",
        "ประกาศที่เกี่ยวข้องกับการบริหารงานบุคคล ปี 2566",
      ],
    },
    {
      name: "มติ คณะกรรมการการบริหารงานบุคคล สจล.",
      description: "มติคณะกรรมการบริหารงานบุคคล",
      tags: [
        "ปี 2569",
        "ปี 2568",
        "ปี 2567",
        "ปี 2566",
      ],
    },
    {
      name: "การสมัครงาน / Application",
      description: "เอกสารเกี่ยวกับการสมัครงานและรายงานตัว",
      tags: [
        "เอกสารการสมัครงาน",
        "เอกสารการรายงานตัว",
      ],
    },
    {
      name: "เครื่องราชอิสริยาภรณ์",
      description: "เอกสารเกี่ยวกับเครื่องราชอิสริยาภรณ์",
      tags: [],
    },
    {
      name: "อื่นๆ",
      description: "หมวดหมู่อื่นๆ ที่ไม่อยู่ในรายการข้างต้น",
      tags: [],
    },
  ]

  for (const [catIndex, categoryData] of categoriesWithTags.entries()) {
    const category = await prisma.documentCategory.upsert({
      where: { Name: categoryData.name },
      update: {},
      create: {
        Name: categoryData.name,
        Description: categoryData.description,
        DisplayOrder: catIndex,
      },
    })

    console.log(`✅ Created/Updated category: ${category.Name}`)

    for (const [tagIndex, tagName] of categoryData.tags.entries()) {
      await prisma.documentTag.upsert({
        where: {
          CategoryId_Name: {
            Name: tagName,
            CategoryId: category.CategoryId,
          },
        },
        update: {},
        create: {
          Name: tagName,
          CategoryId: category.CategoryId,
          Description: null,
          DisplayOrder: tagIndex,
        },
      })
      console.log(`   ✅ Created/Updated tag: ${tagName}`)
    }
  }

  console.log('✅ Document categories and tags seeding complete!')
}

// function toCE(yearBE: number) { return yearBE - 543; }

main()
  .then(() => prisma.$disconnect())
  .catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })