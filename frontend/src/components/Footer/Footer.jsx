import { FiHeart } from 'react-icons/fi';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <p className="footer-text">
          Smart Timetable v1.0.0
        </p>
        <p className="footer-text footer-copyright">
          &copy; {new Date().getFullYear()} Smart Timetable. Built with <FiHeart className="footer-heart" /> using React.js
        </p>
      </div>
    </footer>
  );
}
