// src/pages/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import IconResolver from '../components/IconResolver';
import './pagesStyles/HomePage.css';

// Pequeño componente reutilizable para cada tarjeta
const HomeCard = ({ to, icon, title, description, color }) => {
  return (
    <Link to={to} className="home-card" style={{ '--card-color': color }}>
      <div className="card-icon">
        <IconResolver name={icon} size={48} />
      </div>
      <div className="card-content">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="card-go">
        <IconResolver name="arrow-forward" />
      </div>
    </Link>
  );
};

export default function HomePage() {
  const { user } = useApp();

  return (
    <div className="homepage-container">
      <header className="homepage-header">
        <h1>Bienvenido a BigIA 2.0, {user?.username || 'Usuario'}!</h1>
        <p className="subtitle">
          Selecciona una de las siguientes opciones para empezar a gestionar tu plataforma.
        </p>
      </header>

      <main className="card-grid">
        <HomeCard
          to="/reportes"
          icon="BarChart"
          title="Generar Reportes"
          description="Visualiza y descarga los informes de seguridad y rendimiento."
          color="#007bff"
        />
        <HomeCard
          to="/configuracion/endpoints"
          icon="Tune"
          title="Gestionar Endpoints"
          description="Configura los elementos del menú y sus rutas de acceso."
          color="#28a745"
        />
        <HomeCard
          to="/configuracion/usuarios"
          icon="People"
          title="Administrar Usuarios"
          description="Crea, edita y gestiona los usuarios y sus roles en la plataforma."
          color="#ffc107"
        />
        <HomeCard
          to="/configuracion/personalizacion"
          icon="Palette"
          title="Personalización"
          description="Ajusta la apariencia, los colores y los títulos de la aplicación."
          color="#dc3545"
        />
      </main>
    </div>
  );
}