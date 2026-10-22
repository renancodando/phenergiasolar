const SERRA = {
  latitude: -20.1288,
  longitude: -40.3075,
  timezone: 'America/Sao_Paulo'
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const sky = $('#liveSky');
const sun = $('#sun');
const trackSun = $('#trackSun');
const weatherLabel = $('#weatherLabel');
const localTime = $('#localTime');
const radiation = $('#radiation');
const cloudCover = $('#cloudCover');
const temperature = $('#temperature');
const feelsLike = $('#feelsLike');
const conditionShort = $('#conditionShort');
const sunriseTime = $('#sunriseTime');
const sunsetTime = $('#sunsetTime');
const lastUpdate = $('#lastUpdate');
const progressBar = $('#progressBar');
const topbar = $('#topbar');
const menuButton = $('#menuButton');
const mobileMenu = $('#mobileMenu');

let solarWindow = { sunrise: '05:30', sunset: '18:00' };
let liveWeather = null;

const weatherCodes = {
  0: ['céu limpo', 'Limpo'],
  1: ['predominantemente limpo', 'Quase limpo'],
  2: ['parcialmente nublado', 'Parcial'],
  3: ['céu nublado', 'Nublado'],
  45: ['névoa', 'Névoa'],
  48: ['névoa com geada', 'Névoa'],
  51: ['garoa leve', 'Garoa'],
  53: ['garoa moderada', 'Garoa'],
  55: ['garoa intensa', 'Garoa'],
  61: ['chuva leve', 'Chuva leve'],
  63: ['chuva moderada', 'Chuva'],
  65: ['chuva forte', 'Chuva forte'],
  80: ['pancadas leves', 'Pancadas'],
  81: ['pancadas moderadas', 'Pancadas'],
  82: ['pancadas fortes', 'Pancadas fortes'],
  95: ['trovoadas', 'Trovoadas'],
  96: ['trovoadas com granizo', 'Trovoadas'],
  99: ['trovoadas fortes', 'Trovoadas fortes']
};

function localParts() {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SERRA.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    label: `${parts.hour}:${parts.minute}`
  };
}

function minutesFromTime(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function updateSunPosition() {
  const now = localParts();
  localTime.textContent = now.label;

  const currentMinutes = now.hour * 60 + now.minute + now.second / 60;
  const sunriseMinutes = minutesFromTime(solarWindow.sunrise);
  const sunsetMinutes = minutesFromTime(solarWindow.sunset);
  const daylight = Math.max(1, sunsetMinutes - sunriseMinutes);
  const isDay = liveWeather ? liveWeather.is_day === 1 : currentMinutes >= sunriseMinutes && currentMinutes <= sunsetMinutes;

  let progress = (currentMinutes - sunriseMinutes) / daylight;
  progress = Math.max(0, Math.min(1, progress));

  if (isDay) {
    const x = 6 + progress * 88;
    const arc = Math.sin(progress * Math.PI);
    const y = 72 - arc * 52;
    const trackX = 8 + progress * 84;
    const trackY = 74 - arc * 54;

    sky.classList.remove('night');
    sky.style.setProperty('--sun-x', `${x}%`);
    sky.style.setProperty('--sun-y', `${y}%`);
    trackSun.style.left = `${trackX}%`;
    trackSun.style.top = `${trackY}%`;
  } else {
    sky.classList.add('night');
    trackSun.style.left = currentMinutes < sunriseMinutes ? '4%' : '96%';
    trackSun.style.top = '80%';
  }
}

function applyWeather(data) {
  const current = data.current;
  liveWeather = current;

  const sunrise = data.daily?.sunrise?.[0]?.slice(11, 16);
  const sunset = data.daily?.sunset?.[0]?.slice(11, 16);
  if (sunrise && sunset) solarWindow = { sunrise, sunset };

  sunriseTime.textContent = solarWindow.sunrise;
  sunsetTime.textContent = solarWindow.sunset;

  const clouds = Math.round(current.cloud_cover ?? 0);
  const light = current.is_day === 1 ? Math.max(.32, 1 - clouds / 145) : .05;
  const codeInfo = weatherCodes[current.weather_code] || ['condição variável', 'Variável'];

  sky.style.setProperty('--cloud', `${clouds}%`);
  sky.style.setProperty('--light', light.toFixed(2));

  weatherLabel.textContent = codeInfo[0];
  conditionShort.textContent = codeInfo[1];
  cloudCover.textContent = clouds;
  temperature.textContent = Math.round(current.temperature_2m ?? 0);
  feelsLike.textContent = Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0);
  radiation.textContent = Math.max(0, Math.round(current.shortwave_radiation ?? 0));

  const updated = new Intl.DateTimeFormat('pt-BR', {
    timeZone: SERRA.timezone,
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
  lastUpdate.textContent = `DADOS ${updated} · SERRA/ES`;

  updateSunPosition();
}

async function loadWeather() {
  const params = new URLSearchParams({
    latitude: String(SERRA.latitude),
    longitude: String(SERRA.longitude),
    current: 'temperature_2m,apparent_temperature,is_day,weather_code,cloud_cover,shortwave_radiation,direct_normal_irradiance',
    daily: 'sunrise,sunset',
    timezone: SERRA.timezone,
    forecast_days: '1'
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('weather unavailable');
    const data = await response.json();
    applyWeather(data);
  } catch (error) {
    liveWeather = null;
    weatherLabel.textContent = 'ciclo solar pela hora local';
    conditionShort.textContent = 'Sem conexão';
    lastUpdate.textContent = 'MODO LOCAL · SERRA/ES';
    radiation.textContent = '--';
    cloudCover.textContent = '--';
    temperature.textContent = '--';
    feelsLike.textContent = '--';
    sunriseTime.textContent = solarWindow.sunrise;
    sunsetTime.textContent = solarWindow.sunset;
    sky.style.setProperty('--cloud', '24%');
    sky.style.setProperty('--light', '.82');
    updateSunPosition();
  }
}

function updateScroll() {
  const scrollable = document.documentElement.scrollHeight - innerHeight;
  const progress = scrollable > 0 ? scrollY / scrollable : 0;
  progressBar.style.width = `${Math.min(100, progress * 100)}%`;
  topbar.classList.toggle('scrolled', scrollY > 30);
}

function initReveal() {
  const targets = $$('.reveal');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -7% 0px' });

  targets.forEach(el => observer.observe(el));
}

function closeMenu() {
  menuButton.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  mobileMenu.classList.remove('open');
  mobileMenu.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function initMenu() {
  menuButton.addEventListener('click', () => {
    const open = !mobileMenu.classList.contains('open');
    menuButton.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    mobileMenu.classList.toggle('open', open);
    mobileMenu.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  });

  $$('#mobileMenu a').forEach(link => link.addEventListener('click', closeMenu));
}

function initPointerAtmosphere() {
  if (!matchMedia('(pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const hero = $('.hero');
  const field = $('.panel-field');
  const grid = $('.hero-grid');

  hero.addEventListener('pointermove', event => {
    const x = event.clientX / innerWidth - .5;
    const y = event.clientY / innerHeight - .5;
    field.style.translate = `${x * 13}px ${y * 8}px`;
    grid.style.translate = `${x * -5}px ${y * -3}px`;
  });

  hero.addEventListener('pointerleave', () => {
    field.style.translate = '0 0';
    grid.style.translate = '0 0';
  });
}

function initScenarioTilt() {
  if (!matchMedia('(pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  $$('.scenario').forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - .5;
      const y = (event.clientY - rect.top) / rect.height - .5;
      card.style.transform = `perspective(800px) rotateY(${x * 3}deg) rotateX(${y * -3}deg)`;
    });
    card.addEventListener('pointerleave', () => card.style.transform = '');
  });
}

$('#year').textContent = new Date().getFullYear();
initMenu();
initReveal();
initPointerAtmosphere();
initScenarioTilt();
updateScroll();
updateSunPosition();
loadWeather();

addEventListener('scroll', updateScroll, { passive: true });
setInterval(updateSunPosition, 1000);
setInterval(loadWeather, 15 * 60 * 1000);
