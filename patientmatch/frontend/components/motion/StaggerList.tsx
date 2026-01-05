"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import {
  Children,
  createElement,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  isValidElement,
} from "react";

type AllowedElements = "div" | "ul" | "ol";

interface StaggerListProps extends HTMLAttributes<HTMLElement> {
  as?: AllowedElements;
  children: ReactNode;
  itemClassName?: string;
}

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const motionComponents = {
  div: motion.div,
  ul: motion.ul,
  ol: motion.ol,
} satisfies Record<
  AllowedElements,
  typeof motion.div | typeof motion.ul | typeof motion.ol
>;

const motionItemComponents = {
  div: motion.div,
  ul: motion.li,
  ol: motion.li,
} satisfies Record<AllowedElements, typeof motion.div | typeof motion.li>;

export function StaggerList({
  as = "div",
  className,
  itemClassName,
  children,
  ...props
}: StaggerListProps) {
  const prefersReducedMotion = useReducedMotion();
  const easeOutCurve: [number, number, number, number] = [0.16, 1, 0.3, 1];

  if (prefersReducedMotion) {
    const containerTag = as;
    const itemTag = as === "ul" || as === "ol" ? "li" : "div";

    return createElement(
      containerTag,
      { className: cn(className), ...props },
      Children.map(children, (child, index) => {
        const key =
          (isValidElement(child) && (child as ReactElement).key) ?? index;
        return createElement(
          itemTag,
          { className: cn(itemClassName), key: key ?? index },
          child
        );
      })
    );
  }

  const MotionComponent = motionComponents[as] ?? motion.div;
  const MotionItemComponent = motionItemComponents[as] ?? motion.div;
  const motionProps = props as unknown as HTMLMotionProps<any>;

  return (
    <MotionComponent
      className={cn(className)}
      variants={containerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.28 }}
      {...motionProps}
    >
      {Children.map(children, (child, index) => {
        const key =
          (isValidElement(child) && (child as ReactElement).key) ?? index;
        return (
          <MotionItemComponent
            variants={itemVariants}
            className={cn(itemClassName)}
            key={key ?? index}
            transition={{ duration: 0.45, ease: easeOutCurve }}
          >
            {child}
          </MotionItemComponent>
        );
      })}
    </MotionComponent>
  );
}
