import React from "react";
import { motion } from "framer-motion";

const AppSplash = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4, ease: "easeInOut" } }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#FFFDF8] via-[#FAF6EE] to-[#F3EDE2] dark:from-[#121212] dark:via-[#171717] dark:to-[#0F0F0F] text-[#2C1A0E] dark:text-[#F3EDE2]"
    >
      <div className="relative flex flex-col items-center justify-center">
        {/* Glow effect in the background */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.3, 0.15],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute h-40 w-40 rounded-full bg-[#B8641A] dark:bg-[#FFDFAE] blur-3xl"
        />

        {/* Logo Container */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative flex h-32 w-32 items-center justify-center rounded-[32px] border border-[#EDE8DF] dark:border-white/10 bg-white dark:bg-[#1E1E1E] p-4 shadow-[0_22px_45px_rgba(92,61,30,0.08)] dark:shadow-[0_22px_45px_rgba(0,0,0,0.4)]"
        >
          <motion.img
            src="/favicon.png"
            alt="DairyVision Logo"
            className="h-full w-full object-contain"
            animate={{
              y: [0, -6, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mt-6 text-2xl font-extrabold tracking-[0.2em] uppercase text-[#2C1A0E] dark:text-[#FFDFAE]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          DairyVision
        </motion.h1>

        {/* Bouncing loading dots */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              animate={{
                y: [0, -8, 0],
                opacity: [0.35, 1, 0.35],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: index * 0.15,
                ease: "easeInOut",
              }}
              className="h-2 w-2 rounded-full bg-[#B8641A] dark:bg-[#FFDFAE]"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default AppSplash;
