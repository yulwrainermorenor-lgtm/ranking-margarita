# 🏓 Ranking Estadal Margarita - Tenis de Mesa Nueva Esparta

Aplicación web estática (PWA) moderna y deportiva para la gestión del ranking oficial, perfiles de atletas e historial de partidos de tenis de mesa del Estado Nueva Esparta, Margarita.

---

## ⚡ Características principales

- **Tema Oscuro Deportivo & Rojo Carmesí**: Interfaz mobile-first de alto impacto visual con resplandores neón y animación suave.
- **Podio Top 3**: Tarjetas con medallas metálicas (Oro, Plata, Bronce) para los tres primeros atletas clasificados.
- **Cálculo Oficial Reglamento 2022 (Art. 22)**: Sistema automático de intercambio de puntos Elo por partido.
- **Perfil de Atleta**: Estadísticas completas, victorias/derrotas, winrate %, racha actual, desglose neto de puntos e historial individual.
- **Historial de Partidos**: Lista cronológica con filtrado por atleta y por fecha.
- **Importación / Exportación Excel**: Carga masiva y descarga de ranking y partidos en formatos `.xlsx` y `.csv`.
- **PWA (Instalable)**: Compatible con dispositivos móviles y escritorio, con meta-etiquetas integradas para compartir en WhatsApp con vista previa enriquecida (Open Graph / Twitter Cards).
- **100% Estático**: Sin backend ni base de datos obligatoria. Ideal para Cloudflare Pages.

---

## 🚀 Despliegue en Cloudflare Pages

### Parámetros de Configuración en Cloudflare Pages:

- **Framework preset**: `Vite` (o `None`)
- **Build command (Comando de compilación)**: `npm run build`
- **Build output directory (Directorio de salida)**: `dist`
- **Environment variables (Variables de entorno)**: *Ninguna requerida (sitio 100% estático autónomo)*

---

## 📦 Pasos para subir a GitHub y conectar con Cloudflare Pages

### 1. Inicializar repositorio e ir a GitHub:
```bash
git init
git add .
git commit -m "feat: Rediseño deportivo estático para Cloudflare Pages"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/ranking-margarita.git
git push -u origin main
```

### 2. Conectar a Cloudflare Pages:
1. Inicia sesión en el panel de control de [Cloudflare](https://dash.cloudflare.com/).
2. Dirígete a **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Selecciona el repositorio `ranking-margarita`.
4. En los ajustes del proyecto ingresa:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Haz clic en **Save and Deploy**. ¡Tu sitio estará en línea en segundos!

---

## 🛠️ Desarrollo local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Generar bundle de producción estático
npm run build
```
