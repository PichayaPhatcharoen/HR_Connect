import { prisma } from "./src/lib/prisma";

async function checkFAQs() {
  try {
    const faqs = await prisma.fAQs.findMany({
      include: {
        Category: true,
      },
      orderBy: { UsageCount: "desc" },
    });

    console.log(`Found ${faqs.length} FAQs:\n`);

    faqs.forEach((faq, index) => {
      console.log(`=== FAQ ${index + 1} ===`);
      console.log(`Question: ${faq.Question}`);
      console.log(`Answer: ${faq.Answer.substring(0, 200)}${faq.Answer.length > 200 ? "..." : ""}`);
      console.log(`Category: ${faq.Category?.Name || "None"}`);
      console.log(`Usage Count: ${faq.UsageCount}`);
      console.log("---\n");
    });

    // Look for FAQs containing HR contact info
    const contactFAQs = faqs.filter(faq => 
      faq.Answer.includes("@143thesr") || 
      faq.Answer.includes("lin.ee/fLfASfSp") ||
      faq.Answer.includes("ติดต่อเจ้าหน้าที่")
    );

    if (contactFAQs.length > 0) {
      console.log("\n=== FAQs with HR contact info ===");
      contactFAQs.forEach((faq, index) => {
        console.log(`\n${index + 1}. Question: ${faq.Question}`);
        console.log(`Answer preview: ${faq.Answer.substring(0, 300)}...`);
      });
    } else {
      console.log("\nNo FAQs found with HR contact information");
    }

  } catch (error) {
    console.error("Error checking FAQs:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFAQs();
