import { Navbar } from "../components/landing/Navbar";
import { Hero } from "../components/landing/Hero";
import { About } from "../components/landing/About";
import { Services } from "../components/landing/Services";
import { Coverage } from "../components/landing/Coverage";
import { Contact } from "../components/landing/Contact";
import { Footer } from "../components/landing/Footer";
import { WhatsAppButton } from "../components/landing/WhatsAppButton";

const HomePage = () => {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Services />
        <Coverage />
        <Contact />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
};

export default HomePage;
