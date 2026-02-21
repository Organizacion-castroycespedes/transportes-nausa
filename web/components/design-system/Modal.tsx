import type { ReactNode } from "react";

type ModalProps = {
  title: string;
  children: ReactNode;
};

export const Modal = ({ title, children }: ModalProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-card-foreground">{title}</h3>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};
