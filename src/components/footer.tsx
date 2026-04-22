// src/components/Footer.tsx
import React from "react";
import logo from "../assets/imgs/logotermit.png"; // caminho relativo ao Footer.tsx

const Footer: React.FC = () => (
  <footer className="bg-white-900 text-black py-6 mt-auto border-t border-white-800">
    <div className="max-w-7xl mx-auto px-4 flex flex-col items-center justify-center text-center">
      <p className="text-sm text-black-300 flex items-center gap-1.5">
        Desenvolvido{" "}
        <span className="font-normal text-black">por</span>{" "}
        <img
          src={logo}
          alt="Logo Termit"
          className="h-8 w-auto object-contain"
        />{" "}
        <span className="font-semibold text-black">Termit</span>
      </p>
    </div>
  </footer>
);

export default Footer;