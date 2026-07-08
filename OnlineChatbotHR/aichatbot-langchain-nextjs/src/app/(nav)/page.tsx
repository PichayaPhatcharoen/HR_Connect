import Hero from "@/components/Home/Hero";
import Announcement from "@/components/Home/Announcement";
import React from "react";

const page = () => {
  return (
    <div className="scroll-smooth pb-16 bg-white">
      <Hero />
      <Announcement />
    </div>
  );
};

export default page;
