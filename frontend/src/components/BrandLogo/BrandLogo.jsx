/**
 * BrandLogo - Reusable logo lockup for the whole app.
 *
 * Renders the logo image next to a two-tone animated "Smart Timetable" name.
 *
 * Props:
 *   variant - 'dark' (strong colors for light backgrounds) | 'light' (light colors for dark backgrounds)
 *   size    - 'sm' | 'md' | 'lg'
 *   link    - wrap in <Link to="/"> (default true)
 *   className / onClick - passthrough
 */
import { Link } from 'react-router-dom';
import logo from '../../assets/images/logo.png';
import './BrandLogo.css';

export default function BrandLogo({
  variant = 'dark',
  size = 'md',
  link = true,
  className = '',
  onClick,
}) {
  const content = (
    <>
      <img
        src={logo}
        alt="Smart Timetable logo"
        className={`brand-logo-img brand-logo-img--${size}`}
        draggable={false}
      />
      <span className={`brand-text brand-text--${size}`}>
        <span className="brand-word brand-smart">Smart</span>
        <span className="brand-word brand-timetable">Timetable</span>
      </span>
    </>
  );

  const cls = `brand-logo brand-logo--${variant} ${className}`.trim();

  if (link) {
    return (
      <Link to="/" className={cls} aria-label="Smart Timetable Home" onClick={onClick}>
        {content}
      </Link>
    );
  }

  return <span className={cls}>{content}</span>;
}
