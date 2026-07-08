import Link from "next/link";
import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <div className="w-full h-full overflow-hidden" id="hero">
      <div className="flex flex-col md:flex-row w-full h-full">
        <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-4 md:p-6 h-full">

          <div className="flex-1 flex flex-col justify-center items-center w-full">
            <Image
              src="/HR_LOGO.png"
              alt="HR IT Logo"
              width={1000}
              height={1000}
              className="w-full object-contain h-auto max-h-[60%]"
            />

            <Link href="/chatbot">
              <Button className="bg-white text-blueit hover:bg-blueit hover:text-white text-xl border border-blueit rounded-full px-6 py-2 font-bold shadow flex
              justify-center items-center mt-4">
                ASK CHATBOT
              </Button>
            </Link>
          </div>
        </div>

        <div className="w-full md:w-1/2 h-full">
          <Image
            src="/home/ithome.png"
            alt="ithome"
            width={400}
            height={400}
            className="w-full h-full object-cover"
          />
        </div>

      </div>
    </div>
  );
};

export default Hero;
