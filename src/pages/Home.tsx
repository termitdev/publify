import { useEffect, useRef, useState } from 'react';
import {
  BookOpen, PenTool, Users, Award, Search,
  ArrowRight, ChevronRight, Star, Quote, Send,
  Mail, Phone, MapPin, Instagram, Linkedin, Youtube,
  Headphones, List, Filter, Play, ChevronLeft,
  Sparkles, Globe, TrendingUp, BookMarked
} from 'lucide-react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, useScroll, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

gsap.registerPlugin(ScrollTrigger);

/* ─────────────────────────────────────────
   1. TYPES
───────────────────────────────────────── */
interface Book {
  id: number;
  title: string;
  author: string;
  category: string;
  year: number;
  pages: number;
  spine: string;
  cover: string;
  coverImg: string;
  accent: string;
  featured?: boolean;
  bestseller?: boolean;
}

/* ─────────────────────────────────────────
   2. DATA (20 Livros Completos)
───────────────────────────────────────── */
const books: Book[] = [
  { id: 1,  title: "O Peso do Silêncio",       author: "Beatriz Cavalcante",  category: "Memória",    year: 2024, pages: 312, spine: '#f91808', cover: '#1a1200', coverImg: '/livro1.png', accent: '#fa3b1a', featured: true, bestseller: true },
  { id: 2,  title: "Arquitetura da Mente",      author: "Rafael Nogueira",     category: "Psicologia", year: 2024, pages: 256, spine: '#e2e2e2', cover: '#0d0d0d', coverImg: '/livro2.png', accent: '#e2e2e2', featured: true },
  { id: 3,  title: "Fronteiras do Possível",    author: "Carla Drummond",      category: "Filosofia",  year: 2023, pages: 198, spine: '#c0392b', cover: '#1a0300', coverImg: '/livro3.png', accent: '#e74c3c' },
  { id: 4,  title: "Código e Consciência",      author: "Lucas Abreu",         category: "Tecnologia", year: 2024, pages: 344, spine: '#2980b9', cover: '#00111a', coverImg: '/livro4.png', accent: '#3498db' },
  { id: 5,  title: "O Último Continente",       author: "Mônica Figueiredo",   category: "Ensaio",     year: 2023, pages: 221, spine: '#27ae60', cover: '#001208', coverImg: '/livro5.png', accent: '#2ecc71' },
  { id: 6,  title: "Sombras no Espelho",        author: "Jorge Henrique",      category: "Ficção",     year: 2024, pages: 287, spine: '#8e44ad', cover: '#0d0018', coverImg: '/livro6.png', accent: '#9b59b6', featured: true, bestseller: true },
  { id: 7,  title: "Raízes da Liderança",       author: "Patrícia Lemos",      category: "Negócios",   year: 2023, pages: 265, spine: '#f9b308', cover: '#1a1200', coverImg: '/livro7.png', accent: '#f9b308' },
  { id: 8,  title: "Voz das Margens",           author: "Davi Santana",        category: "Poesia",     year: 2024, pages: 144, spine: '#e91e8c', cover: '#1a0011', coverImg: '/livro8.png', accent: '#e91e8c' },
  { id: 9,  title: "Neurociência e Propósito",  author: "Ana Lima",            category: "Ciência",    year: 2023, pages: 398, spine: '#00bcd4', cover: '#001618', coverImg: '/livro9.png', accent: '#00bcd4' },
  { id: 10, title: "A Gramática do Caos",       author: "Fernando Braga",      category: "Filosofia",  year: 2024, pages: 310, spine: '#e2e2e2', cover: '#0a0a0a', coverImg: '/livro10.png', accent: '#ffffff' },
  { id: 11, title: "Mãos que Constroem",        author: "Isabela Torres",      category: "Memória",    year: 2023, pages: 189, spine: '#ff6b35', cover: '#1a0800', coverImg: '/livro11.png', accent: '#ff6b35' },
  { id: 12, title: "Democracia Fraturada",      author: "Paulo Mendes",        category: "Política",   year: 2024, pages: 332, spine: '#c0392b', cover: '#150000', coverImg: '/livro12.png', accent: '#e74c3c' },
  { id: 13, title: "O Algoritmo e a Alma",      author: "Renata Vieira",       category: "Tecnologia", year: 2023, pages: 275, spine: '#5c6bc0', cover: '#060818', coverImg: '/livro13.png', accent: '#7986cb' },
  { id: 14, title: "Cartografia do Afeto",      author: "Juliana Neves",       category: "Psicologia", year: 2024, pages: 230, spine: '#26a69a', cover: '#001210', coverImg: '/livro14.png', accent: '#26a69a' },
  { id: 15, title: "Além do Horizonte",         author: "César Almada",        category: "Ensaio",     year: 2023, pages: 204, spine: '#f9b308', cover: '#1a1200', coverImg: '/livro15.png', accent: '#f9b308' },
  { id: 16, title: "Negócios com Propósito",    author: "Adriana Castro",      category: "Negócios",   year: 2024, pages: 288, spine: '#bdbdbd', cover: '#080808', coverImg: '/livro16.png', accent: '#e0e0e0' },
  { id: 17, title: "Herança do Futuro",         author: "Márcio Barros",       category: "Ciência",    year: 2023, pages: 356, spine: '#7e57c2', cover: '#0a0018', coverImg: '/livro17.png', accent: '#9575cd' },
  { id: 18, title: "A Última Lição",            author: "Sonia Ramos",         category: "Educação",   year: 2024, pages: 167, spine: '#ec407a', cover: '#180010', coverImg: '/livro18.png', accent: '#f48fb1' },
];

const categories = ['Todos', ...Array.from(new Set(books.map(b => b.category)))];

const authors = [
  { name: "Beatriz Cavalcante", genre: "Memória & Narrativa", books: 3, img: "BC" },
  { name: "Rafael Nogueira",    genre: "Psicologia Aplicada", books: 5, img: "RN" },
  { name: "Ana Lima",           genre: "Neurociência",        books: 4, img: "AL" },
  { name: "Fernando Braga",     genre: "Filosofia Crítica",   books: 6, img: "FB" },
  { name: "Clarissa Moura",     genre: "Comportamento",       books: 2, img: "CM" },
];

const genres = [
  { name: "Ficção",     count: 0, icon: BookOpen,    color: '#8e44ad' },
  { name: "Filosofia",  count: 0, icon: Sparkles,    color: '#f9b308' },
  { name: "Negócios",   count: 0, icon: TrendingUp,  color: '#27ae60' },
  { name: "Ciência",    count: 0,  icon: Globe,       color: '#2980b9' },
  { name: "Psicologia", count: 0, icon: BookMarked,  color: '#e91e8c' },
  { name: "Poesia",     count: 0,  icon: PenTool,     color: '#ff6b35' },
];

const audiobooks = [
  { id: 1, title: "Agenda Estoica",      author: "Lucia Helena Galvão", duration: "8h 42m", category: "Memória"    },
  { id: 2, title: "Viagem ao Planeta Poin Poin",     author: "Hiram Baroli",    duration: "7h 15m", category: "Psicologia" },
  { id: 6, title: "xxx",       author: "Thiago Castro",     duration: "9h 03m", category: "Ficção"     },
  { id: 9, title: "yyyy", author: "Marjorie Jasper",           duration: "11h 20m", category: "Ciência"   },
];

const reviews = [
  { name: "Luiza",         role: "Autora publicada",        body: "A Literare transformou meu manuscrito em uma obra que realmente se destaca nas prateleiras.", rating: 5 },
  { name: "Thiago Castro", role: "Dr. em Neurociências",      body: "Maior editora em autismo do Brasil. Meu livro chegou a escolas e famílias que jamais imaginei.", rating: 5 },
  { name: "Hiram Baroli",  role: "Escritor e palestrante",    body: "A revisão técnica é impecável — quatro etapas antes da aprovação final. Sem uma vírgula fora do lugar.", rating: 5 },
  { name: "Chris Pelajo",  role: "Comunicador e autor",       body: "Uma editora com visão estratégica. Entenderam minha marca antes de entenderem meu livro.", rating: 5 },
  { name: "Lucedile",      role: "Pedagoga e escritora",      body: "A Literare publica livros que inspiram. Desde o primeiro contato, senti que estavam tão investidos quanto eu.", rating: 5 },
  { name: "André Maués",   role: "Advogado e autor jurídico", body: "Profissionalismo do início ao fim. Distribuição que me levou a faculdades inacessíveis sozinho.", rating: 5 },
];

const lists = [
  { title: "Melhores do Século XXI",  books: 15, votes: "15.8k", img: [books[0], books[1], books[5]] },
  { title: "Filosofia Antiga",        books: 70, votes: "16.2k", img: [books[2], books[9], books[19]] },
  { title: "Terror Literário",        books: 120, votes: "18.3k", img: [books[5], books[11], books[18]] },
];

const MARQUEE_ITEMS = [
  'Autoridade Editorial', '·', 'Revisão Técnica', '·', 'Best-Sellers', '·',
  'Curadoria Exclusiva', '·', 'Distribuição Nacional', '·', 'Não-Ficção', '·',
  'Autores de Impacto', '·', 'Precisão ABNT', '·',
];

/* ─────────────────────────────────────────
   3. BOOK COVER COMPONENT (Com a imagem de fundo)
───────────────────────────────────────── */
/* ─────────────────────────────────────────
   3. BOOK COVER COMPONENT (Apenas Capa)
───────────────────────────────────────── */
function BookCover({ book, size = 'md' }: { book: Book; size?: 'sm' | 'md' | 'lg' }) {
  // Mantendo a proporção real de 16cm x 23cm (Aprox 1:1.43)
  const dimensions = {
    sm: { width: '208px', height: '300px' },
    md: { width: '208px', height: '300px' },
    lg: { width: '208px', height: '300px' }
  };

  return (
    <div
      className="book-cover-wrapper" // Classe para animações externas se necessário
      style={{
        width: dimensions[size].width,
        height: dimensions[size].height,
        position: 'relative',
        borderRadius: '2px 4px 4px 2px', // Leve curvatura para parecer um livro
        overflow: 'hidden',
        // Sombra projetada e sombra interna sutil no "canto da lombada"
        boxShadow: `
          8px 8px 20px rgba(0,0,0,0.4),
          inset 3px 0 10px rgba(0,0,0,0.2)
        `,
        flexShrink: 0,
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        cursor: 'pointer',
        backgroundColor: book.cover, // Cor de fundo caso a imagem demore a carregar
      }}
    >
      <img 
        src={book.coverImg} 
        alt={book.title}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover', // Garante que preencha todo o espaço sem distorcer
          display: 'block'
        }}
      />

      {/* A lombada visual (opcional): 
        Se você quer que pareça um livro real sem nada escrito, 
        mantivemos apenas um gradiente linear sutil na esquerda para simular a dobra.
      */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '5px',
        background: 'linear-gradient(to right, rgba(0,0,0,0.2), transparent)',
        pointerEvents: 'none'
      }} />
    </div>
  );
}

/* ─────────────────────────────────────────
   4. HOME PAGE MAIN COMPONENT
───────────────────────────────────────── */
export default function Home() {
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchTerm, setSearchTerm]         = useState('');
  const [showcaseIdx, setShowcaseIdx]       = useState(0);
  const cursorRef   = useRef<HTMLDivElement>(null);
  const marqueeRef  = useRef<HTMLDivElement>(null);
  const heroRef     = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  const heroY  = useTransform(scrollYProgress, [0, 0.2], [0, -60]);

  const filteredBooks = books.filter(b => {
    const matchCat  = activeCategory === 'Todos' || b.category === activeCategory;
    const matchSrch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      b.author.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSrch;
  });

  /* cursor anim */
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!cursorRef.current) return;
      gsap.to(cursorRef.current, { x: e.clientX - 14, y: e.clientY - 14, duration: 0.5, ease: 'power2.out' });
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

  /* marquee anim */
  useEffect(() => {
    if (!marqueeRef.current) return;
    const inner = marqueeRef.current.querySelector<HTMLElement>('.marquee-inner');
    if (!inner) return;
    const totalW = inner.scrollWidth / 2;
    gsap.to(inner, {
      x: -totalW, duration: 32, ease: 'none', repeat: -1,
      modifiers: { x: gsap.utils.unitize(v => parseFloat(v) % totalW) },
    });
  }, []);

  /* scroll reveal anims */
  useEffect(() => {
    gsap.utils.toArray<HTMLElement>('.reveal-up').forEach(el => {
      gsap.fromTo(el,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true } }
      );
    });

    gsap.utils.toArray<HTMLElement>('.stagger-grid').forEach(parent => {
      const kids = parent.querySelectorAll<HTMLElement>(':scope > *');
      gsap.fromTo(kids,
        { opacity: 0, y: 36, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.07, ease: 'power2.out',
          scrollTrigger: { trigger: parent, start: 'top 82%', once: true } }
      );
    });
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'NewJune';
          src: url('\NewJuneRegular.ttf') format('truetype');
          font-weight: normal; 
          font-style: normal; 
          font-display: swap;
        }
        @font-face {
          font-family: 'NewJuneRegular';
          src: url('\NewJuneRegular.ttf') format('truetype');
          font-weight: normal; 
          font-style: normal; 
          font-display: swap;
        }
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Poppins', sans-serif; background: #ffffff; color: #111111; overflow-x: hidden; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f0f0f0; }
        ::-webkit-scrollbar-thumb { background: #f9b308; border-radius: 2px; }

        .grid-bg {
          background-image:
            linear-gradient(rgba(0,0,0,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.035) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .grid-bg-dark {
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .marquee-inner { display: flex; width: max-content; will-change: transform; }

        .pill-active { background: #000 !important; color: #fff !important; border-color: #000 !important; }

        .book-card { transition: transform 0.3s ease, box-shadow 0.3s ease; cursor: pointer; }
        .book-card:hover { transform: translateY(-6px); }

        .author-card:hover .author-ring { border-color: #f9b308 !important; }
        .genre-card { transition: all 0.3s ease; }
        .genre-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(0,0,0,0.12) !important; }

        .nav-link { position: relative; }
        .nav-link::after { content: ''; position: absolute; bottom: -2px; left: 0; width: 0; height: 2px; background: #f9b308; transition: width 0.3s ease; }
        .nav-link:hover::after { width: 100%; }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-12px) rotate(-2deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(3deg); }
          50% { transform: translateY(-8px) rotate(3deg); }
        }
        .float-1 { animation: float 6s ease-in-out infinite; }
        .float-2 { animation: float2 5s ease-in-out infinite 1s; }
        .float-3 { animation: float 7s ease-in-out infinite 0.5s; }

        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .stack-mobile { flex-direction: column !important; }
        }
      `}} />

      {/* progress bar */}
      <motion.div className="fixed top-0 left-0 right-0 z-[100]"
        style={{ height: '3px', scaleX, transformOrigin: '0%', background: '#f9b308' }} />

      {/* custom cursor */}
      <div ref={cursorRef} className="hide-mobile" style={{
        position: 'fixed', width: '28px', height: '28px', borderRadius: '50%',
        pointerEvents: 'none', zIndex: 999, mixBlendMode: 'multiply',
        background: 'rgba(249,179,8,0.5)', border: '1.5px solid #f9b308',
      }} />

      {/* FIXED BG */}
      <div className="grid-bg" style={{
        position: 'fixed', inset: 0, zIndex: 0, background: '#ffffff', pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(249,179,8,0.06) 0%, transparent 70%)',
        }} />
      </div>

      {/* HEADER */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90,
        padding: '0 32px', height: '72px', display: 'flex', alignItems: 'center',
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src="/logo.png" alt="Literare" style={{ height: '36px', objectFit: 'contain' }} />

          <nav className="hide-mobile" style={{ display: 'flex', gap: '36px', alignItems: 'center' }}>
            {[
              { label: 'Catálogo', url: '#catalogo' },
              { label: 'Feedbacks', url: '#autores' },
              { label: 'Loja Literare Books', url: 'https://loja.literarebooks.com.br/' }
            ].map(item => (
              <a 
                key={item.label} 
                href={item.url} 
                target={item.url.startsWith('http') ? '_blank' : '_self'}
                rel={item.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="nav-link"
                style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#555', textDecoration: 'none' }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Link to="/login" className="hide-mobile" style={{
              padding: '8px 20px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: '3px',
              color: '#111', textDecoration: 'none', transition: 'all 0.2s',
            }}>Login</Link>
            <Link to="/submit" style={{
              padding: '9px 22px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', background: '#f9b308', color: '#111', textDecoration: 'none',
              borderRadius: '3px', transition: 'opacity 0.2s',
            }}>Publicar →</Link>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div style={{ position: 'relative', zIndex: 10, overflowX: 'hidden' }}>

        {/* ════ HERO ════ */}
        <section ref={heroRef} style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          paddingTop: '100px', paddingBottom: '60px', paddingLeft: '32px', paddingRight: '32px',
          overflow: 'hidden',
        }}>
          <motion.div style={{ y: heroY, maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
              {/* left */}
              <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                  <div style={{ width: '40px', height: '2px', background: '#f9b308' }} />
                  <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#888' }}>
                    Literare Books · +20 anos no mercado Editorial.
                  </span>
                </div>

                <h1 style={{
                  fontFamily: "'NewJune', serif", fontSize: 'clamp(3.5rem, 7vw, 6.5rem)',
                  lineHeight: 0.92, letterSpacing: '-0.02em', color: '#0a0a0a', marginBottom: '28px',
                }}>
                  Seu <span style={{ color: '#f9b308', display: 'inline-block', position: 'relative' }}>
                    conhecimento
                    <svg style={{ position: 'absolute', bottom: '-4px', left: 0, width: '100%' }} viewBox="0 0 300 8" fill="none">
                      <path d="M2 6 Q75 2 150 5 Q225 8 298 4" stroke="#f9b308" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5"/>
                    </svg>
                  </span> merece<br />estar publicado.
                </h1>

                <p style={{ fontSize: '16px', fontWeight: 300, color: '#555', lineHeight: 1.7, maxWidth: '440px', marginBottom: '40px' }}>
                  Curadoria exclusiva, revisão técnica rigorosa e distribuição nacional — tudo que o autor moderno precisa para se tornar a referência da sua área.
                </p>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Link to="/submit" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '10px',
                    padding: '16px 32px', background: '#000', color: '#f9b308',
                    fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase', textDecoration: 'none', borderRadius: '3px',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}>
                    Publicar meu livro <ArrowRight size={15} />
                  </Link>
                  <a href="#catalogo" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    fontSize: '13px', fontWeight: 500, color: '#888', textDecoration: 'none',
                  }}>
                    Ver catálogo <ChevronRight size={14} />
                  </a>
                </div>

                <div style={{ display: 'flex', gap: '40px', marginTop: '56px', paddingTop: '40px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                  {[['2.000+','Autores'], ['Nº 1','Não-ficção'], ['800+','Livros pulicados']].map(([v, l]) => (
                    <div key={l}>
                      <p style={{ fontFamily: "'NewJune', serif", fontSize: '2rem', lineHeight: 1, color: '#111' }}>{v}</p>
                      <p style={{ fontSize: '11px', fontWeight: 500, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '4px' }}>{l}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* right — floating books */}
              <motion.div className="hide-mobile" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.3, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} style={{ position: 'relative', height: '560px' }}>
                <div className="float-1" style={{ position: 'absolute', top: '20px', left: '10%', width: '42%', zIndex: 3 }}>
                  <BookCover book={books[0]} size="lg" />
                </div>
                <div className="float-2" style={{ position: 'absolute', top: '60px', right: '5%', width: '38%', zIndex: 2 }}>
                  <BookCover book={books[5]} size="md" />
                </div>
                <div className="float-3" style={{ position: 'absolute', bottom: '40px', left: '20%', width: '36%', zIndex: 4 }}>
                  <BookCover book={books[1]} size="md" />
                </div>
                <div className="float-1" style={{ position: 'absolute', bottom: '20px', right: '8%', width: '30%', zIndex: 1, animationDelay: '2s' }}>
                  <BookCover book={books[3]} size="sm" />
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                  width: '70%', height: '60px', borderRadius: '50%',
                  background: 'radial-gradient(ellipse, rgba(0,0,0,0.15), transparent 70%)',
                }} />
              </motion.div>
            </div>
          </motion.div>

          <div style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: '20px', height: '32px', border: '2px solid rgba(0,0,0,0.2)', borderRadius: '10px', display: 'flex', justifyContent: 'center', paddingTop: '6px' }}>
              <div style={{ width: '4px', height: '8px', borderRadius: '2px', background: '#f9b308' }} />
            </motion.div>
          </div>
        </section>

        {/* ════ MARQUEE ════ */}
        <div ref={marqueeRef} style={{ overflow: 'hidden', padding: '14px 0', borderTop: '1px solid rgba(0,0,0,0.08)', borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#000' }}>
          <div className="marquee-inner">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <span key={i} style={{
                flexShrink: 0, padding: '0 20px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.25em',
                whiteSpace: 'nowrap', color: item === '·' ? '#f9b308' : 'rgba(255,255,255,0.6)',
              }}>{item}</span>
            ))}
          </div>
        </div>

        {/* ════ SEARCH BAR & CATÁLOGO ════ */}
        <section id="catalogo" style={{ padding: '48px 32px 80px', maxWidth: '1400px', margin: '0 auto' }}>
          <p>Um pouco do nosso Cátalogo!</p><br/>

          <div className="stagger-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px' }}>
            {filteredBooks.map(book => (
               <div key={book.id} className="book-card">
                 <BookCover book={book} />
               </div>
            ))}
          </div>
        </section>

        {/* ════ AUTHORS ════ */}
        <section id="autores" style={{ padding: '80px 32px', maxWidth: '1400px', margin: '0 auto' }}>
          <div className="reveal-up" style={{ marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ width: '28px', height: '2px', background: '#f9b308' }} />
              <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#999' }}>O que dizem nossos Autores</span>
            </div>
            <h2 style={{ fontFamily: "'NewJuneRegular', serif", fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', lineHeight: 1, color: '#111' }}>
              Veja os <span style={{ color: '#f9b308' }}>Feedbacks</span>
            </h2>
          </div>

          <div className="stagger-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div className="author-card" style={{ background: '#1a1a1a', borderRadius: '6px', padding: '32px', cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
              <div className="grid-bg-dark" style={{ position: 'absolute', inset: 0, borderRadius: '6px' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="author-ring" style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f9b308', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontFamily: "'NewJune', serif", fontWeight: 700, color: '#111', marginBottom: '20px', border: '3px solid transparent', transition: 'border-color 0.3s' }}>LL</div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#f9b308', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>Perspectivas Legais</p>
                <p style={{ fontFamily: "'NewJune', serif", fontSize: '1.6rem', color: '#fff', lineHeight: 1.1, marginBottom: '12px' }}>Luiza Lucena</p>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontWeight: 300 }}>Amo Publicar com a Literare</p>
              </div>
            </div>

            <div style={{ background: '#fff8e6', borderRadius: '6px', padding: '32px', cursor: 'pointer', border: '1.5px solid rgba(249,179,8,0.2)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#f9b308', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontFamily: "'NewJune', serif", fontWeight: 700, color: '#111', marginBottom: '20px' }}>HB</div>
                <p style={{ fontFamily: "'NewJune', serif", fontSize: '1.5rem', color: '#111', lineHeight: 1.1, marginBottom: '8px' }}>Hiram Baroli<br /></p>
                <p style={{ fontSize: '13px', color: '#888', fontWeight: 300 }}>Editora muito influente no mercado editorial!</p>
              </div>
            </div>

            <div style={{ background: '#f5f5f0', borderRadius: '6px', padding: '32px', cursor: 'pointer', border: '1.5px solid rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontFamily: "'NewJune', serif", fontWeight: 700, color: '#f9b308', marginBottom: '20px' }}>TC</div>
                <p style={{ fontFamily: "'NewJune', serif", fontSize: '1.5rem', color: '#111', lineHeight: 1.1, marginBottom: '8px' }}>Dr. Thiago Castro</p>
                <p style={{ fontSize: '13px', color: '#888', fontWeight: 300 }}>Literare tem se tornando referência em coautoria no País</p>
              </div>
            </div>
          </div>
        </section>
        
        {/* ════ FOOTER (Adicional Básico) ════ */}
        <footer style={{ background: '#111', color: '#fff', padding: '60px 32px' }}>
           <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px' }}>
             <div>
               <h3 style={{ color: '#f9b308', fontWeight: 'bold', marginBottom: '16px' }}>Literare Books</h3>
               <p style={{ fontSize: '13px', color: '#888' }}>Transformando conhecimento em legado a mais de 20 anos.</p>
             </div>
             <div>
               <h4 style={{ fontWeight: 'bold', marginBottom: '16px' }}>Contato</h4>
               <p style={{ fontSize: '13px', color: '#888' }}>+55 11 2659-0968<br/>contato@literare.com.br</p>
             </div>
           </div>
        </footer>

      </div>
    </>
  );
}