import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Calendar, 
  Table as TableIcon, 
  Dice5, 
  RotateCcw, 
  Share2, 
  Check, 
  Clock, 
  MapPin, 
  Sparkles, 
  ChevronRight, 
  Activity, 
  Save, 
  Search, 
  Users,
  ClipboardList, 
  AlertCircle, 
  User, 
  Gift,
  Crown,
  TrendingUp,
  Download,
  CheckCircle2,
  ListFilter,
  Info,
  Lock,
  Unlock,
  ShieldAlert,
  Sliders,
  FileSpreadsheet,
  LogOut,
  RefreshCw,
  Edit,
  SlidersHorizontal,
  Award,
  Target,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Team, Match, Group, GroupStandings, StageType } from './types';
import { TEAMS, GROUPS, VENUES, generateGroupStageMatches, generateKnockoutMatches } from './data';
import { 
  computeAllStandings, 
  getRankedThirdPlacedTeams, 
  resolveTeam, 
  getKnockoutWinnerId, 
  getKnockoutLoserId, 
  isPredictionFilled, 
  simulateMatchScores,
  resolveAllThirds
} from './utils';

// Ecuador Cédula validación logic client-side
export function isEcuadorianCedulaValid(cedula: string): boolean {
  if (!cedula || cedula.length !== 10) return false;
  if (!/^\d+$/.test(cedula)) return false;

  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;

  const tercerDigito = parseInt(cedula.charAt(2), 10);
  if (tercerDigito >= 6) return false;

  const n = cedula.length;
  let total = 0;
  for (let i = 0; i < n - 1; i++) {
    let num = parseInt(cedula.charAt(i), 10);
    if (i % 2 === 0) { // odd positions (0, 2, 4...)
      num = num * 2;
      if (num > 9) num -= 9;
    }
    total += num;
  }

  const digitoVerificador = parseInt(cedula.charAt(9), 10);
  const decenaSuperior = Math.ceil(total / 10) * 10;
  let calculado = decenaSuperior - total;
  if (calculado === 10) calculado = 0;

  return calculado === digitoVerificador;
}

export function getTeamFlagUrl(teamId: string): string {
  const mapping: Record<string, string> = {
    MEX: 'mx', RSA: 'za', KOR: 'kr', CZE: 'cz',
    CAN: 'ca', BIH: 'ba', QAT: 'qa', SUI: 'ch',
    BRA: 'br', MAR: 'ma', HAI: 'ht', SCO: 'gb-sct',
    USA: 'us', PAR: 'py', NZL: 'nz', TUR: 'tr',
    GER: 'de', CUW: 'cw', CIV: 'ci', ECU: 'ec',
    NED: 'nl', JPN: 'jp', SWE: 'se', TUN: 'tn',
    BEL: 'be', EGY: 'eg', IRN: 'ir', AUS: 'au',
    ESP: 'es', CPV: 'cv', KSA: 'sa', URU: 'uy',
    FRA: 'fr', SEN: 'sn', IRQ: 'iq', NOR: 'no',
    ARG: 'ar', ALG: 'dz', AUT: 'at', JOR: 'jo',
    POR: 'pt', COD: 'cd', UZB: 'uz', COL: 'co',
    ENG: 'gb-eng', CRO: 'hr', GHA: 'gh', PAN: 'pa'
  };
  const code = mapping[teamId] || 'un';
  return `https://flagcdn.com/w40/${code}.png`;
}

// Static confetti configurations for splash screen representation (realistic gold metallic particles)
const CONFETTI_PARTICLES = Array.from({ length: 48 }).map((_, i) => {
  const isGold = i % 3 !== 0;
  return {
    id: i,
    left: `${(i * 2.3) % 100}%`,
    delay: (i * 0.1) % 4.8,
    duration: 3.5 + ((i * 0.4) % 4.5),
    scale: 0.5 + ((i * 0.12) % 0.8),
    rotate: (i * 35) % 360,
    opacity: 0.6 + ((i * 0.08) % 0.4),
    width: i % 2 === 0 ? 12 : 8,
    height: i % 2 === 0 ? 6 : 4,
    color: isGold ? '#F59E0B' : '#FFFFFF', // gold vs white-gold metallic spark
    shadow: isGold ? '0px 0px 8px rgba(245,158,11,0.6)' : '0px 0px 8px rgba(255,255,255,0.4)',
  };
});

export default function App() {
  // Splash Screen State
  const [showSplash, setShowSplash] = useState(true);
  const [splashProgress, setSplashProgress] = useState(0);

  // Session State
  const [currentUser, setCurrentUser] = useState<{ id: string; nombreCompleto: string; cedula: string; correo?: string; empresa: string; localidad: string; role: 'user' | 'admin' } | null>(() => {
    const saved = localStorage.getItem('polla_user_session');
    return saved ? JSON.parse(saved) : null;
  });

  // User list of matches and predictions combined
  const [matches, setMatches] = useState<Match[]>([]);
  const [officialResults, setOfficialResults] = useState<Record<string, { homeScore?: number; awayScore?: number; winnerId?: string }>>({});
  const [userPredictions, setUserPredictions] = useState<Record<string, { predictedHome: string; predictedAway: string; predictedWinnerId?: string; completed?: boolean }>>({});
  
  // Registration Form State
  const [regNombre, setRegNombre] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regCorreo, setRegCorreo] = useState('');
  const [regEmpresa, setRegEmpresa] = useState('PRODUMAR SA');
  const [regLocalidad, setRegLocalidad] = useState('San Pablo');
  const [loginError, setLoginError] = useState('');
  const [regError, setRegError] = useState('');
  const [loginCedula, setLoginCedula] = useState('');
  const [loginCorreo, setLoginCorreo] = useState('');
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');

  // Manual Classification Overrides for Bracket Generation
  const [manualFirstPlaces, setManualFirstPlaces] = useState<Record<string, string>>({}); // group -> teamId
  const [manualSecondPlaces, setManualSecondPlaces] = useState<Record<string, string>>({}); // group -> teamId
  const [manualThirdPlaces, setManualThirdPlaces] = useState<string[]>([]); // array of teamIds (exactly 8)
  const [manualThirdsByGroup, setManualThirdsByGroup] = useState<Record<string, string>>({}); // group -> teamId or 'no_aplica'
  const [unlockedGroups, setUnlockedGroups] = useState<Record<string, boolean>>({}); // group -> boolean for manual lock bypass

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'info' | 'groups' | 'calendar' | 'bracket' | 'ranking' | 'admin' | 'profile' | 'awards'>('info');

  // Filters
  const [calendarSubTab, setCalendarSubTab] = useState<'pending' | 'completed'>('pending');
  const [stageFilter, setStageFilter] = useState<StageType | 'all'>('all');
  const [groupFilter, setGroupFilter] = useState<string | 'all'>('all');
  const [searchTeam, setSearchTeam] = useState('');
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [showPointsManual, setShowPointsManual] = useState<boolean>(true);
  const [activeRuleAccordion, setActiveRuleAccordion] = useState<number | null>(0);
  const [profileSearchTerm, setProfileSearchTerm] = useState('');
  const [profileSearchWeek, setProfileSearchWeek] = useState<string>('all');
  const [profileOnlyWithPoints, setProfileOnlyWithPoints] = useState(false);

  // General States
  const [toast, setToast] = useState<string | null>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [unlockedWeek, setUnlockedWeek] = useState<number>(1);

  // System Config with Awards
  const [systemConfig, setSystemConfig] = useState<any>({
    unlockedWeek: 1,
    official_balon_oro: '',
    official_guante_oro: '',
    official_bota_oro: '',
    official_joven_torneo: ''
  });

  // Predictions states for FIFA Awards
  const [predBalonOro, setPredBalonOro] = useState('');
  const [predGuanteOro, setPredGuanteOro] = useState('');
  const [predBotaOro, setPredBotaOro] = useState('');
  const [predJovenTorneo, setPredJovenTorneo] = useState('');

  // Admin states for FIFA Awards Config
  const [adminBalonOro, setAdminBalonOro] = useState('');
  const [adminGuanteOro, setAdminGuanteOro] = useState('');
  const [adminBotaOro, setAdminBotaOro] = useState('');
  const [adminJovenTorneo, setAdminJovenTorneo] = useState('');
  
  // Admin Participant Filters & Search & Deletion States
  const [adminCompanyFilter, setAdminCompanyFilter] = useState<string>('all');
  const [adminLocalityFilter, setAdminLocalityFilter] = useState<string>('all');
  const [adminUserSearch, setAdminUserSearch] = useState<string>('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  
  // Admin Score Entry Form
  const [selectedAdminMatchStage, setSelectedAdminMatchStage] = useState<StageType | 'all'>('all');
  const [selectedAdminMatchWeek, setSelectedAdminMatchWeek] = useState<string>('all');
  const [adminScores, setAdminScores] = useState<Record<string, { home: string; away: string; winner?: string }>>({});

  // Loading indicator for server syncs
  const [loading, setLoading] = useState(false);

  // Helper toast notification
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // Generate blank group matches and knockout match stubs on load
  const loadBaseMatches = () => {
    return [...generateGroupStageMatches(), ...generateKnockoutMatches()];
  };

  const initialMatches = useMemo(() => loadBaseMatches(), []);

  // Fetch unlocked config
  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data) {
        setSystemConfig(data);
        if (typeof data.unlockedWeek === 'number') {
          setUnlockedWeek(data.unlockedWeek);
          setSelectedAdminMatchWeek(data.unlockedWeek.toString());
        }
      }
    } catch (e) {
      console.error('Error fetching config:', e);
    }
  };

  // Sync data with server
  const fetchScoresAndPredictions = async (userId: string) => {
    try {
      setLoading(true);
      
      // Fetch official scores
      const resOfficial = await fetch('/api/admin/results');
      const dataOfficial = await resOfficial.json();
      const officialMap: Record<string, any> = {};
      if (Array.isArray(dataOfficial)) {
        dataOfficial.forEach((item) => {
          officialMap[item.matchId] = {
            homeScore: item.homeScore,
            awayScore: item.awayScore,
            winnerId: item.winnerId
          };
        });
      }
      setOfficialResults(officialMap);

      // Fetch user predictions
      if (userId) {
        const resPred = await fetch(`/api/predictions/${userId}`);
        const dataPred = await resPred.json();
        setUserPredictions(dataPred);

        // Parse custom group overrides from db predictions
        const loadedFirsts: Record<string, string> = {};
        const loadedSeconds: Record<string, string> = {};
        const loadedThirds: Record<string, string> = {};
        const loadedThirdList: string[] = [];

        Object.keys(dataPred).forEach((key) => {
          if (key.startsWith('group_override_first_')) {
            const group = key.replace('group_override_first_', '');
            loadedFirsts[group] = dataPred[key].predictedWinnerId || '';
          } else if (key.startsWith('group_override_second_')) {
            const group = key.replace('group_override_second_', '');
            loadedSeconds[group] = dataPred[key].predictedWinnerId || '';
          } else if (key.startsWith('group_override_third_')) {
            const group = key.replace('group_override_third_', '');
            const val = dataPred[key].predictedWinnerId || '';
            loadedThirds[group] = val;
            if (val && val !== 'no_aplica' && !loadedThirdList.includes(val)) {
              loadedThirdList.push(val);
            }
          }
        });

        if (Object.keys(loadedFirsts).length > 0) {
          setManualFirstPlaces(loadedFirsts);
        }
        if (Object.keys(loadedSeconds).length > 0) {
          setManualSecondPlaces(loadedSeconds);
        }
        if (Object.keys(loadedThirds).length > 0) {
          setManualThirdsByGroup(loadedThirds);
        }

        const loadedBestThirdsPrediction = dataPred['group_override_best_thirds_list'];
        if (loadedBestThirdsPrediction && loadedBestThirdsPrediction.predictedWinnerId) {
          const list = loadedBestThirdsPrediction.predictedWinnerId.split(',').filter(Boolean);
          setManualThirdPlaces(list);
        } else if (loadedThirdList.length > 0) {
          setManualThirdPlaces(loadedThirdList.slice(0, 8));
        }
      }
    } catch (e) {
      console.error('Error fetching scores:', e);
    } finally {
      setLoading(false);
    }
  };

  // Sync rankings
  const fetchRankings = async () => {
    try {
      const res = await fetch('/api/ranking');
      const data = await res.json();
      if (Array.isArray(data)) {
        setRanking(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Sync users (admin only)
  const fetchAdminData = async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const headers = { 'x-user-id': currentUser.id };
      const [resUsers, resStats] = await Promise.all([
        fetch('/api/admin/users', { headers }),
        fetch('/api/admin/stats', { headers })
      ]);
      const dataUsers = await resUsers.json();
      const dataStats = await resStats.json();
      
      if (Array.isArray(dataUsers)) {
        setAdminUsers(dataUsers);
      }
      setAdminStats(dataStats);
    } catch (e) {
      console.error(e);
    }
  };

  // Splash Screen Progress Simulator effect
  useEffect(() => {
    if (showSplash) {
      const interval = setInterval(() => {
        setSplashProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            const timeout = setTimeout(() => {
              setShowSplash(false);
            }, 600);
            return 100;
          }
          // Increments randomly for realistic progress
          const increment = Math.floor(Math.random() * 8) + 4; // 4% to 11%
          const next = prev + increment;
          return next > 100 ? 100 : next;
        });
      }, 140);
      return () => clearInterval(interval);
    }
  }, [showSplash]);

  useEffect(() => {
    if (currentUser) {
      fetchConfig();
      fetchScoresAndPredictions(currentUser.id);
      fetchRankings();
      if (currentUser.role === 'admin') {
        fetchAdminData();
      }
    }
  }, [currentUser]);

  // Sync predictions values to states
  useEffect(() => {
    if (userPredictions) {
      setPredBalonOro(userPredictions['award_balon_oro']?.predictedWinnerId || '');
      setPredGuanteOro(userPredictions['award_guante_oro']?.predictedWinnerId || '');
      setPredBotaOro(userPredictions['award_bota_oro']?.predictedWinnerId || '');
      setPredJovenTorneo(userPredictions['award_joven_torneo']?.predictedWinnerId || '');
    }
  }, [userPredictions]);

  // Sync official system awards config to admin fields
  useEffect(() => {
    if (systemConfig) {
      setAdminBalonOro(systemConfig.official_balon_oro || '');
      setAdminGuanteOro(systemConfig.official_guante_oro || '');
      setAdminBotaOro(systemConfig.official_bota_oro || '');
      setAdminJovenTorneo(systemConfig.official_joven_torneo || '');
    }
  }, [systemConfig]);

  // Combine static match structures with official achievements & user predictions
  const combinedMatches = useMemo(() => {
    return initialMatches.map((base) => {
      const prediction = userPredictions[base.id] || {};
      const official = officialResults[base.id] || {};

      return {
        ...base,
        // user prediction details
        predictedHome: prediction.predictedHome !== undefined ? prediction.predictedHome : '',
        predictedAway: prediction.predictedAway !== undefined ? prediction.predictedAway : '',
        predictedWinnerId: prediction.predictedWinnerId,
        completed: !!prediction.completed,
        // official logic
        homeScore: official.homeScore,
        awayScore: official.awayScore,
        winnerId: official.winnerId
      };
    });
  }, [initialMatches, userPredictions, officialResults]);

  // Compute standings in real time from predictions (only if they are filled in database / UI)
  const standings = useMemo(() => computeAllStandings(combinedMatches), [combinedMatches]);
  const rankedThirds = useMemo(() => getRankedThirdPlacedTeams(standings), [standings]);

  // Check if group stage predictions and selections have been completed
  const isGroupStageSelectionsCompleted = useMemo(() => {
    const hasAllFirst = GROUPS.every(g => manualFirstPlaces[g] && manualFirstPlaces[g].trim() !== '');
    const hasAllSecond = GROUPS.every(g => manualSecondPlaces[g] && manualSecondPlaces[g].trim() !== '');
    const hasEightThirds = manualThirdPlaces.length === 8;
    return hasAllFirst && hasAllSecond && hasEightThirds;
  }, [manualFirstPlaces, manualSecondPlaces, manualThirdPlaces]);

  // Handle auto-populating selectors (1st, 2nd, best thirds) based on real standings
  const handleAutoClassifyWithStandings = () => {
    if (isGroupStageSelectionsLocked()) {
      showToast('🔒 El registro de posiciones de la fase de grupos está bloqueado. El primer partido inicia en menos de 1 hora.');
      return;
    }

    const firsts: Record<string, string> = {};
    const seconds: Record<string, string> = {};
    const thirds: Record<string, string> = {};

    GROUPS.forEach((gId) => {
      const groupStandings = standings[gId];
      if (groupStandings && groupStandings.length >= 2) {
        firsts[gId] = groupStandings[0].teamId;
        seconds[gId] = groupStandings[1].teamId;
      }
    });

    const top8Thirds = rankedThirds.slice(0, 8).map(t => t.id);

    GROUPS.forEach((gId) => {
      const groupStandings = standings[gId];
      if (groupStandings && groupStandings.length >= 3) {
        const thirdTeamId = groupStandings[2].teamId;
        if (top8Thirds.includes(thirdTeamId)) {
          thirds[gId] = thirdTeamId;
        } else {
          thirds[gId] = 'no_aplica';
        }
      }
    });

    setManualFirstPlaces(firsts);
    setManualSecondPlaces(seconds);
    setManualThirdsByGroup(thirds);
    setManualThirdPlaces(top8Thirds);
    showToast('⚽ Clasificación autocompletada en base a las posiciones de tus pronósticos!');
    
    // Auto save all completed groups and best thirds list
    GROUPS.forEach((gId) => {
      const f = firsts[gId];
      const s = seconds[gId];
      const t = thirds[gId];
      if (f && s && t) {
        handleSaveGroupSelections(gId, f, s, t);
      }
    });

    handleSaveBestThirds(top8Thirds);
  };

  // Save selected top 8 best thirds to DB
  const handleSaveBestThirds = async (newList: string[]) => {
    if (!currentUser) return;
    const payload = {
      group_override_best_thirds_list: {
        predictedHome: '0',
        predictedAway: '0',
        predictedWinnerId: newList.join(','),
        completed: true
      }
    };
    try {
      const res = await fetch(`/api/predictions/${currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions: payload })
      });
      const data = await res.json();
      if (data.success) {
        setUserPredictions(prev => ({ ...prev, ...payload }));
      }
    } catch (err) {
      console.error('Error saving best thirds list:', err);
    }
  };

  const handleSaveAwardPredictions = async () => {
    if (!currentUser) return;
    const payload: Record<string, any> = {
      award_balon_oro: {
        predictedHome: '0',
        predictedAway: '0',
        predictedWinnerId: predBalonOro,
        completed: false
      },
      award_guante_oro: {
        predictedHome: '0',
        predictedAway: '0',
        predictedWinnerId: predGuanteOro,
        completed: false
      },
      award_bota_oro: {
        predictedHome: '0',
        predictedAway: '0',
        predictedWinnerId: predBotaOro,
        completed: false
      },
      award_joven_torneo: {
        predictedHome: '0',
        predictedAway: '0',
        predictedWinnerId: predJovenTorneo,
        completed: false
      }
    };

    try {
      const res = await fetch(`/api/predictions/${currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions: payload })
      });
      const data = await res.json();
      if (data.success) {
        setUserPredictions(prev => ({ ...prev, ...payload }));
        await fetchRankings(); // Sync ratings immediately to recalculate total points
        showToast('🏆 ¡Pronósticos de Premios FIFA guardados con éxito!');
      } else {
        showToast(`❌ Error al guardar premios: ${data.error || 'Intente de nuevo'}`);
      }
    } catch (err) {
      console.error(err);
      showToast('❌ Error de conexión al guardar pronósticos de premios');
    }
  };

  const handleSaveAdminAwards = async () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    try {
      const res = await fetch('/api/admin/config/awards', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          official_balon_oro: adminBalonOro,
          official_guante_oro: adminGuanteOro,
          official_bota_oro: adminBotaOro,
          official_joven_torneo: adminJovenTorneo
        })
      });
      const data = await res.json();
      if (data.success) {
        setSystemConfig(data.config);
        await fetchRankings(); // Re-calculate everything to update rankings immediately
        showToast('🏆 Resultados Oficiales de Premios FIFA registrados con éxito. ¡Puntos acumulados!');
      } else {
        showToast(`❌ Error al guardar resultados oficiales: ${data.error || 'Intente de nuevo'}`);
      }
    } catch (err) {
      console.error(err);
      showToast('❌ Error de conexión al guardar resultados de premios');
    }
  };

  // Save manual classification of completed group to DB
  const handleSaveGroupSelections = async (gId: string, firstVal: string, secondVal: string, thirdVal: string) => {
    if (!currentUser) return;
    
    const payload: Record<string, any> = {};
    payload[`group_override_first_${gId}`] = {
      predictedHome: '0',
      predictedAway: '0',
      predictedWinnerId: firstVal,
      completed: true
    };
    payload[`group_override_second_${gId}`] = {
      predictedHome: '0',
      predictedAway: '0',
      predictedWinnerId: secondVal,
      completed: true
    };
    payload[`group_override_third_${gId}`] = {
      predictedHome: '0',
      predictedAway: '0',
      predictedWinnerId: thirdVal,
      completed: true
    };

    try {
      const res = await fetch(`/api/predictions/${currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions: payload })
      });
      const data = await res.json();
      if (data.success) {
        setUserPredictions(prev => ({ ...prev, ...payload }));
        showToast(`✅ ¡Grupo ${gId} guardado con éxito! Las opciones han sido bloqueadas.`);
      } else {
        showToast(`❌ Error al guardar clasificación del Grupo ${gId}: ${data.error || 'Intente de nuevo'}`);
      }
    } catch (err) {
      console.error(err);
      showToast(`❌ Error de conexión al guardar Grupo ${gId}`);
    }
  };

  // Helper verifying if a group is fully selected and triggers saving
  const checkAndSaveGroup = (gId: string, firstVal: string, secondVal: string, thirdVal: string) => {
    if (firstVal && secondVal && thirdVal) {
      // Check if they match current saved to avoid unnecessary API writes
      const currentFirst = userPredictions[`group_override_first_${gId}`]?.predictedWinnerId;
      const currentSecond = userPredictions[`group_override_second_${gId}`]?.predictedWinnerId;
      const currentThird = userPredictions[`group_override_third_${gId}`]?.predictedWinnerId;
      
      if (currentFirst === firstVal && currentSecond === secondVal && currentThird === thirdVal) {
        return;
      }
      
      // Auto-save
      handleSaveGroupSelections(gId, firstVal, secondVal, thirdVal);
    }
  };

  // Resolve team function that respects manual classification selectors, or falls back to actual standings
  const resolveTeamWithManualOverrides = (id: string): Team | { placeholder: string; text: string } => {
    // If it's a real direct team ID
    const directTeam = TEAMS.find((t) => t.id === id);
    if (directTeam) return directTeam;

    // Pattern A: 1st place overridden
    const firstMatch = id.match(/^1([A-L])$/);
    if (firstMatch) {
      const gr = firstMatch[1];
      if (isGroupStageSelectionsCompleted) {
        const teamId = manualFirstPlaces[gr];
        if (teamId) {
          const team = TEAMS.find(t => t.id === teamId);
          if (team) return team;
        }
        // Fallback
        const groupStandings = standings[gr];
        if (groupStandings && groupStandings.length > 0) {
          const team = TEAMS.find((t) => t.id === groupStandings[0].teamId);
          if (team) return team;
        }
      }
      return { placeholder: id, text: `1° Grupo ${gr}` };
    }

    // Pattern B: 2nd place overridden
    const runnerMatch = id.match(/^2([A-L])$/);
    if (runnerMatch) {
      const gr = runnerMatch[1];
      if (isGroupStageSelectionsCompleted) {
        const teamId = manualSecondPlaces[gr];
        if (teamId) {
          const team = TEAMS.find(t => t.id === teamId);
          if (team) return team;
        }
        // Fallback
        const groupStandings = standings[gr];
        if (groupStandings && groupStandings.length > 1) {
          const team = TEAMS.find((t) => t.id === groupStandings[1].teamId);
          if (team) return team;
        }
      }
      return { placeholder: id, text: `2do Grupo ${gr}` };
    }

    // Pattern C: Best thirds custom slot matching (e.g., 3_ABCDF)
    if (id.startsWith('3_')) {
      if (isGroupStageSelectionsCompleted) {
        // Find manual thirds that belong to the allowed groups
        const thirdsToUse = manualThirdPlaces.length === 8 
          ? manualThirdPlaces.map(tid => TEAMS.find(t => t.id === tid)).filter(Boolean) as Team[]
          : rankedThirds;

        const thirdsMap = resolveAllThirds(thirdsToUse);
        if (thirdsMap[id]) {
          return thirdsMap[id];
        }
      }
      return { placeholder: id, text: `3ro (Gr. ${id.substring(2)})` };
    }

    // Pattern D: Knockout Winner
    const wkMatch = id.match(/^WK(\d+)$/);
    if (wkMatch) {
      const mId = `K${wkMatch[1]}`;
      const match = combinedMatches.find((m) => m.id === mId);
      if (match) {
        const winnerId = getKnockoutWinnerIdWithOverrides(match);
        if (winnerId) {
          const team = TEAMS.find((t) => t.id === winnerId);
          if (team) return team;
        }
      }
      return { placeholder: id, text: `Ganador P.${wkMatch[1]}` };
    }

    // Pattern E: Knockout Loser
    const lkMatch = id.match(/^LK(\d+)$/);
    if (lkMatch) {
      const mId = `K${lkMatch[1]}`;
      const match = combinedMatches.find((m) => m.id === mId);
      if (match) {
        const loserId = getKnockoutLoserIdWithOverrides(match);
        if (loserId) {
          const team = TEAMS.find((t) => t.id === loserId);
          if (team) return team;
        }
      }
      return { placeholder: id, text: `Perdedor P.${lkMatch[1]}` };
    }

    return { placeholder: id, text: id };
  };

  // Helper custom knockout winner resolver to respect manual overrides
  function getKnockoutWinnerIdWithOverrides(match: Match): string | undefined {
    const home = resolveTeamWithManualOverrides(match.homeTeamId);
    const away = resolveTeamWithManualOverrides(match.awayTeamId);

    if ('placeholder' in home || 'placeholder' in away) return undefined;

    const hScoreStr = match.predictedHome;
    const aScoreStr = match.predictedAway;

    if (hScoreStr === undefined || hScoreStr.trim() === '' || aScoreStr === undefined || aScoreStr.trim() === '') {
      return undefined;
    }

    const hScore = parseInt(hScoreStr, 10);
    const aScore = parseInt(aScoreStr, 10);

    if (isNaN(hScore) || isNaN(aScore)) return undefined;

    if (hScore > aScore) return home.id;
    if (hScore < aScore) return away.id;

    if (match.predictedWinnerId && (match.predictedWinnerId === home.id || match.predictedWinnerId === away.id)) {
      return match.predictedWinnerId;
    }
    return home.id; // penalty fallback
  }

  function getKnockoutLoserIdWithOverrides(match: Match): string | undefined {
    const home = resolveTeamWithManualOverrides(match.homeTeamId);
    const away = resolveTeamWithManualOverrides(match.awayTeamId);

    if ('placeholder' in home || 'placeholder' in away) return undefined;

    const winnerId = getKnockoutWinnerIdWithOverrides(match);
    if (!winnerId) return undefined;

    return winnerId === home.id ? away.id : home.id;
  }

  const renderBracketMatchCard = (m: any) => {
    const homeRes = resolveTeamWithManualOverrides(m.homeTeamId);
    const awayRes = resolveTeamWithManualOverrides(m.awayTeamId);
    const winnerId = getKnockoutWinnerIdWithOverrides(m);

    const isHomePlaceholder = 'placeholder' in homeRes;
    const isAwayPlaceholder = 'placeholder' in awayRes;

    const hScore = userPredictions[m.id]?.predictedHome || '';
    const aScore = userPredictions[m.id]?.predictedAway || '';
    const pWinnerId = userPredictions[m.id]?.predictedWinnerId;

    const isTimeLocked = isMatchLockedForTime(m);
    const isWeeklyLocked = isMatchWeeklyLocked(m.date);
    const hasOfficialResult = m.homeScore !== undefined;
    const isLocked = m.completed || isTimeLocked || isWeeklyLocked || hasOfficialResult;

    const isDisabled = isLocked || isHomePlaceholder || isAwayPlaceholder;
    const isTie = hScore !== '' && aScore !== '' && parseInt(hScore, 10) === parseInt(aScore, 10);
    const isReadyToSave = hScore !== '' && aScore !== '' && (!isTie || pWinnerId);

    const handleLocalSave = () => {
      if (isTie && !pWinnerId) {
        showToast('⚠️ Selecciona el ganador de penales primero.');
        return;
      }
      handleSavePrediction(m.id, m.date, m.time);
    };

    const selectWinnerWithSave = async (selectedId: string) => {
      setUserPredictions(prev => {
        const matchPred = prev[m.id] || { predictedHome: '', predictedAway: '' };
        return { ...prev, [m.id]: { ...matchPred, predictedWinnerId: selectedId } };
      });

      if (!currentUser) return;
      const payload = {
        [m.id]: {
          predictedHome: hScore,
          predictedAway: aScore,
          predictedWinnerId: selectedId,
          meta: { date: m.date, time: m.time }
        }
      };
      try {
        const res = await fetch(`/api/predictions/${currentUser.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ predictions: payload })
        });
        const data = await res.json();
        if (data.success) {
          setUserPredictions(prev => ({ ...prev, ...payload }));
          showToast('⚽ ¡Resultado de penales registrado con éxito!');
        }
      } catch (err) {
        console.error(err);
      }
    };

    return (
      <div key={m.id} className={`bg-slate-900/80 border p-3 rounded-xl space-y-2 text-xs relative hover:border-slate-700 transition-colors ${m.completed ? 'border-emerald-800/30 bg-emerald-950/5' : 'border-slate-850'}`}>
        <div className="flex items-center justify-between pb-1 border-b border-slate-950">
          <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">M- {m.id}</div>
          {!isLocked && isReadyToSave && (
            <button
              onClick={handleLocalSave}
              className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold underline flex items-center gap-0.5 bg-transparent border-none p-0 cursor-pointer"
            >
              <Save className="h-2.5 w-2.5" />
              <span>Guardar</span>
            </button>
          )}
        </div>
        
        {/* Home Row */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
            {'flag' in homeRes ? (
              <img src={getTeamFlagUrl((homeRes as any).id)} className="w-5 h-3.5 object-cover rounded shadow-sm border border-slate-800 shrink-0" alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="shrink-0 text-xs text-slate-500">🏳️</span>
            )}
            <span className={`truncate font-semibold ${winnerId === (homeRes as any).id ? 'text-amber-400 font-extrabold shadow-sm' : 'text-slate-300'}`}>
              {'name' in homeRes ? homeRes.name : homeRes.text}
            </span>
          </div>

          <input
            type="text"
            disabled={isDisabled}
            value={hScore}
            onChange={(e) => handleLocalPredictionChange(m.id, 'home', e.target.value)}
            placeholder="-"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLocalSave();
            }}
            className="w-8 text-center bg-slate-950 border border-slate-800 rounded py-0.5 px-1 text-xs text-amber-400 font-bold font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Away Row */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
            {'flag' in awayRes ? (
              <img src={getTeamFlagUrl((awayRes as any).id)} className="w-5 h-3.5 object-cover rounded shadow-sm border border-slate-800 shrink-0" alt="" referrerPolicy="no-referrer" />
            ) : (
              <span className="shrink-0 text-xs text-slate-500">🏳️</span>
            )}
            <span className={`truncate font-semibold ${winnerId === (awayRes as any).id ? 'text-amber-400 font-extrabold shadow-sm' : 'text-slate-300'}`}>
              {'name' in awayRes ? awayRes.name : awayRes.text}
            </span>
          </div>

          <input
            type="text"
            disabled={isDisabled}
            value={aScore}
            onChange={(e) => handleLocalPredictionChange(m.id, 'away', e.target.value)}
            placeholder="-"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLocalSave();
            }}
            className="w-8 text-center bg-slate-950 border border-slate-800 rounded py-0.5 px-1 text-xs text-amber-400 font-bold font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
          />
        </div>

        {/* Tie Breaker if Tie */}
        {isTie && !isLocked && (
          <div className="pt-2 border-t border-slate-950 mt-1 space-y-1">
            <div className="text-[8px] text-amber-400 font-bold uppercase">Empate. Escoge el ganador:</div>
            <div className="flex gap-1.5">
              <button
                onClick={() => selectWinnerWithSave((homeRes as any).id)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer truncate flex-1 ${
                  pWinnerId === (homeRes as any).id ? 'bg-amber-400 text-slate-950 shadow' : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {(homeRes as any).name || 'L'}
              </button>
              <button
                onClick={() => selectWinnerWithSave((awayRes as any).id)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer truncate flex-1 ${
                  pWinnerId === (awayRes as any).id ? 'bg-amber-400 text-slate-950 shadow' : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {(awayRes as any).name || 'V'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Handle logging in
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cleanCedula = loginCedula.trim();
    const cleanCorreo = loginCorreo.trim().toLowerCase();

    if (!cleanCedula || !cleanCorreo) {
      setLoginError('Ingresa tu correo y número de cédula para iniciar sesión.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: cleanCedula, correo: cleanCorreo })
      });
      const data = await res.json();

      if (!res.ok) {
        setLoginError(data.error || 'Error al iniciar sesión.');
        return;
      }

      localStorage.setItem('polla_user_session', JSON.stringify(data.user));
      setCurrentUser(data.user);
      showToast(`👋 ¡Bienvenido de vuelta, ${data.user.nombreCompleto}!`);
    } catch (err) {
      setLoginError('Error de red al intentar ingresar.');
    } finally {
      setLoading(false);
    }
  };

  // Handle registering new participant
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    const cleanNombre = regNombre.trim();
    const cleanCorreo = regCorreo.trim().toLowerCase();
    let cleanCedula = regCedula.trim().replace(/\s+/g, '');

    if (!cleanNombre || !cleanCedula || !cleanCorreo) {
      setRegError('Completa todos los campos obligatorios.');
      return;
    }

    if (!cleanCorreo.includes('@') || !cleanCorreo.includes('.')) {
      setRegError('El formato de correo electrónico ingresado es inválido.');
      return;
    }

    // Client-side Cédula check
    if (!isEcuadorianCedulaValid(cleanCedula)) {
      setRegError('El formato de la cédula ecuatoriana ingresada es inválido.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreCompleto: cleanNombre,
          cedula: cleanCedula,
          correo: cleanCorreo,
          empresa: regEmpresa,
          localidad: regLocalidad
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setRegError(data.error || 'Error de registro.');
        return;
      }

      localStorage.setItem('polla_user_session', JSON.stringify(data.user));
      setCurrentUser(data.user);
      showToast(`🎉 ¡Registro exitoso! ¡Buena suerte, ${data.user.nombreCompleto}!`);
    } catch (err) {
      setRegError('Error de red al intentar registrarse.');
    } finally {
      setLoading(false);
    }
  };

  // Logout / clear session
  const handleLogout = () => {
    localStorage.removeItem('polla_user_session');
    setCurrentUser(null);
    setUserPredictions({});
    showToast('Sesión cerrada.');
  };

  // Normalize player name accents, whitespaces, and case for accurate comparison
  const normalizeAwardName = (text?: string): string => {
    if (!text) return '';
    return text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  };

  // Check if a match is locked for time based on 1 hour kickoff rule
  const isMatchLockedForTime = (match: Match): boolean => {
    const serverTimeMs = Date.now();
    const [year, month, day] = match.date.split('-').map(Number);
    const [hours, minutes] = match.time.split(':').map(Number);
    const matchTimeMs = new Date(year, month - 1, day, hours, minutes).getTime();
    
    // Less than 1 hour remaining!
    return (matchTimeMs - serverTimeMs) <= 60 * 60 * 1000;
  };

  // Check if group stage manual classification is locked (1 hour before first match start)
  const isGroupStageSelectionsLocked = (): boolean => {
    const serverTimeMs = Date.now();
    // First match starts on 2026-06-11 at 14:00. Note: month 5 is June (0-indexed)
    const firstMatchTimeMs = new Date(2026, 5, 11, 14, 0).getTime();
    return (firstMatchTimeMs - serverTimeMs) <= 60 * 60 * 1000;
  };

  const getMatchWeek = (matchDate: string): number => {
    if (!matchDate) return 1;
    if (matchDate <= '2026-06-14') return 1;
    if (matchDate <= '2026-06-21') return 2;
    if (matchDate <= '2026-06-28') return 3;
    if (matchDate <= '2026-07-05') return 4;
    if (matchDate <= '2026-07-12') return 5;
    return 6;
  };

  const isMatchWeeklyLocked = (matchDate: string): boolean => {
    const matchWeek = getMatchWeek(matchDate);
    return matchWeek !== unlockedWeek;
  };

  // Update a prediction input in local state on the fly
  const handleLocalPredictionChange = (matchId: string, side: 'home' | 'away', value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) return;

    setUserPredictions(prev => {
      const matchPred = prev[matchId] || { predictedHome: '', predictedAway: '' };
      const updated = { ...matchPred };
      if (side === 'home') updated.predictedHome = value;
      if (side === 'away') updated.predictedAway = value;

      // Handle win decider reset in draw changes
      if (updated.predictedHome !== '' && updated.predictedAway !== '') {
        if (parseInt(updated.predictedHome, 10) !== parseInt(updated.predictedAway, 10)) {
          delete updated.predictedWinnerId;
        }
      }
      return { ...prev, [matchId]: updated };
    });
  };

  // Handle tie winner penalties click
  const handleLocalWinnerDecider = (matchId: string, winnerId: string) => {
    setUserPredictions(prev => {
      const matchPred = prev[matchId] || { predictedHome: '', predictedAway: '' };
      return { ...prev, [matchId]: { ...matchPred, predictedWinnerId: winnerId } };
    });
    showToast('👑 Clasificado guardado temporalmente.');
  };

  // Save single prediction to backend database, locking it once registered!
  const handleSavePrediction = async (matchId: string, matchDate: string, matchTime: string) => {
    if (!currentUser) return;

    const pred = userPredictions[matchId];
    if (!pred || pred.predictedHome === '' || pred.predictedAway === '') {
      showToast('⚠️ Ingresa los puntajes antes de guardar.');
      return;
    }

    const payload = {
      [matchId]: {
        predictedHome: pred.predictedHome,
        predictedAway: pred.predictedAway,
        predictedWinnerId: pred.predictedWinnerId,
        meta: { date: matchDate, time: matchTime }
      }
    };

    try {
      setLoading(true);
      const res = await fetch(`/api/predictions/${currentUser.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predictions: payload })
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(`❌ Error: ${data.error}`);
        return;
      }

      // Merge updated prediction record (which is now locked as completed)
      setUserPredictions(prev => ({
        ...prev,
        [matchId]: { ...prev[matchId], completed: true }
      }));
      showToast('💾 ¡Pronóstico guardado y bloqueado con éxito!');
      fetchScoresAndPredictions(currentUser.id);
    } catch (e) {
      showToast('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Save official game score results (Admin panel)
  const handleSaveOfficialAdminScores = async () => {
    if (!currentUser || currentUser.role !== 'admin') return;

    const payloadList = Object.keys(adminScores).map(matchId => ({
      matchId,
      homeScore: adminScores[matchId].home,
      awayScore: adminScores[matchId].away,
      winnerId: adminScores[matchId].winner
    }));

    if (payloadList.length === 0) {
      showToast('No hay resultados oficiales ingresados para guardar.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/admin/results', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ results: payloadList })
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(`❌ Error: ${data.error}`);
        return;
      }

      showToast('🏆 Resultados oficiales registrados. Rangos actualizados.');
      setAdminScores({});
      fetchScoresAndPredictions(currentUser.id);
      fetchRankings();
      fetchAdminData();
    } catch (e) {
      showToast('Falla de conexión al actualizar resultados.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle user block status (Admin Only)
  const handleToggleBlockUser = async (userId: string, currentBlocked: boolean) => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ blocked: !currentBlocked })
      });

      if (!res.ok) {
        const errorData = await res.json();
        showToast(`Error: ${errorData.error}`);
        return;
      }

      showToast(currentBlocked ? '🔓 Usuario desbloqueado exitosamente.' : '🔒 Usuario bloqueado exitosamente.');
      fetchAdminData();
      fetchRankings();
    } catch (e) {
      showToast('Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  // Delete user account (Admin Only)
  const handleDeleteUser = async (userId: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 
          'x-user-id': currentUser.id
        }
      });

      if (!res.ok) {
        const errorData = await res.json();
        showToast(`❌ Error: ${errorData.error}`);
        return;
      }

      showToast('🗑️ Usuario eliminado correctamente.');
      setDeletingUserId(null);
      fetchAdminData();
      fetchRankings();
    } catch (e) {
      showToast('❌ Error de conexión al eliminar usuario.');
    } finally {
      setLoading(false);
    }
  };

  // Unique list of companies from existing participants
  const adminCompanies = useMemo(() => {
    const list = adminUsers.map((u) => u.empresa).filter(Boolean);
    return Array.from(new Set(list)).sort() as string[];
  }, [adminUsers]);

  // Unique list of localities from existing participants
  const adminLocalities = useMemo(() => {
    const list = adminUsers.map((u) => u.localidad).filter(Boolean);
    return Array.from(new Set(list)).sort() as string[];
  }, [adminUsers]);

  // Dynamically filtered and searched participant list for admin display
  const filteredAdminUsers = useMemo(() => {
    return adminUsers.filter((usr) => {
      const matchesCompany = adminCompanyFilter === 'all' || usr.empresa === adminCompanyFilter;
      const matchesLocality = adminLocalityFilter === 'all' || usr.localidad === adminLocalityFilter;

      let matchesSearch = true;
      if (adminUserSearch.trim() !== '') {
        const q = adminUserSearch.toLowerCase();
        const nameOk = usr.nombreCompleto?.toLowerCase().includes(q) || usr.nombre?.toLowerCase().includes(q);
        const cedulaOk = usr.cedula?.toLowerCase().includes(q);
        const correoOk = usr.correo?.toLowerCase().includes(q);
        matchesSearch = !!(nameOk || cedulaOk || correoOk);
      }

      return matchesCompany && matchesLocality && matchesSearch;
    });
  }, [adminUsers, adminCompanyFilter, adminLocalityFilter, adminUserSearch]);

  // Update unlocked week config (Admin Only)
  const handleUpdateUnlockedWeek = async (week: number) => {
    if (!currentUser || currentUser.role !== 'admin') return;

    try {
      setLoading(true);
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
        },
        body: JSON.stringify({ unlockedWeek: week }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(`❌ Error: ${data.error || 'No se pudo cambiar la configuración'}`);
        return;
      }

      setUnlockedWeek(week);
      setSelectedAdminMatchWeek(week.toString());
      showToast(`🔓 Semana ${week} de partidos habilitada exitosamente.`);
    } catch (e) {
      showToast('❌ Error de conexión al actualizar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  const uniqueMatchDates = useMemo(() => {
    const dates = combinedMatches.map(m => m.date).filter(Boolean);
    return Array.from(new Set(dates)).sort();
  }, [combinedMatches]);

  const formatDateFriendly = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const day = parts[2];
    const month = parts[1];
    const monthNames: Record<string, string> = {
      '06': 'Jun',
      '07': 'Jul',
      '08': 'Ago'
    };
    return `${day} ${monthNames[month] || month}`;
  };

  // Client Filtered Match lists for display under "Partidos" tab
  const filteredMatches = useMemo(() => {
    return combinedMatches.filter((m) => {
      // Filter tab stage
      const matchesStage = stageFilter === 'all' || m.stage === stageFilter;
      // Filter group
      const matchesGroup = groupFilter === 'all' || m.group === groupFilter;
      
      // Filter Week
      let matchesWeek = true;
      if (weekFilter !== 'all') {
        const matchWeek = getMatchWeek(m.date);
        matchesWeek = matchWeek.toString() === weekFilter;
      }

      // Filter Date
      const matchesDate = dateFilter === 'all' || m.date === dateFilter;

      // Filter search name
      let matchesSearch = true;
      if (searchTeam.trim() !== '') {
        const homeResolved = resolveTeamWithManualOverrides(m.homeTeamId);
        const awayResolved = resolveTeamWithManualOverrides(m.awayTeamId);
        const hName = 'name' in homeResolved ? homeResolved.name : '';
        const aName = 'name' in awayResolved ? awayResolved.name : '';
        matchesSearch = hName.toLowerCase().includes(searchTeam.toLowerCase()) || 
                        aName.toLowerCase().includes(searchTeam.toLowerCase());
      }

      // Filter subtab (pending vs completed/registered)
      const matchesSubTab = calendarSubTab === 'pending' ? !m.completed : m.completed;

      return matchesStage && matchesGroup && matchesWeek && matchesDate && matchesSearch && matchesSubTab;
    });
  }, [combinedMatches, calendarSubTab, stageFilter, groupFilter, weekFilter, dateFilter, searchTeam, manualFirstPlaces, manualSecondPlaces, manualThirdPlaces, unlockedWeek]);

  // Handle simulated predictions for remaining gaps
  const handleRandomFillPendingPredictions = () => {
    const randomSet: Record<string, any> = {};
    combinedMatches.forEach(m => {
      if (!m.completed) {
        const homeRes = resolveTeamWithManualOverrides(m.homeTeamId);
        const awayRes = resolveTeamWithManualOverrides(m.awayTeamId);
        const homeRank = 'rank' in homeRes ? homeRes.rank : 50;
        const awayRank = 'rank' in awayRes ? awayRes.rank : 50;

        const sim = simulateMatchScores(homeRank, awayRank);
        let winId: string | undefined;
        if (sim.home === sim.away) {
          winId = Math.random() > 0.5 ? ('id' in homeRes ? homeRes.id : undefined) : ('id' in awayRes ? awayRes.id : undefined);
        }

        randomSet[m.id] = {
          predictedHome: sim.home.toString(),
          predictedAway: sim.away.toString(),
          predictedWinnerId: winId
        };
      }
    });

    setUserPredictions(prev => ({ ...prev, ...randomSet }));
    showToast('🎲 Se pre-cargaron resultados simulados al azar, ¡recuerda presionar Guardar!');
  };

  // Render splash screen if active
  if (showSplash) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a1e3e] via-[#041026] to-[#010510] text-slate-100 flex flex-col justify-between items-center px-4 py-8 relative overflow-hidden font-sans select-none">
        
        {/* Cinematic Stadium Spotlight Lens Flares (Cyan lights on the sides match image) */}
        <div className="absolute left-[-20%] md:left-[-10%] top-[30%] w-[60%] h-[40%] bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none z-0" />
        <div className="absolute right-[-20%] md:right-[-10%] top-[30%] w-[60%] h-[40%] bg-cyan-500/15 rounded-full blur-[100px] pointer-events-none z-0" />
        
        {/* Beam light highlights */}
        <div className="absolute left-0 top-[20%] w-[100px] h-[300px] bg-cyan-400/10 rounded-full blur-[80px] rotate-45 pointer-events-none z-0" strokeDasharray="5" />
        <div className="absolute right-0 top-[20%] w-[100px] h-[300px] bg-cyan-400/10 rounded-full blur-[80px] -rotate-45 pointer-events-none z-0" />

        {/* Full-Screen Soccer Stadium & Ball Under Lights Background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src="https://images.unsplash.com/photo-1579952365544-300539940e45?q=80&w=1200"
            alt="Soccer ball in stadium on grass field under lights"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center opacity-95 scale-100"
          />
          {/* Subtle top/bottom gradients to maintain high UI text contrast while keeping the stadium structure and center grass soccer ball completely bright and vivid */}
          <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-[#0a1e3e] via-[#041026]/75 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-[#010510] via-[#010510]/60 to-transparent" />
        </div>

        {/* High-Fidelity Gold and Silver Falling Confetti Leaf Overlay */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-20">
          {CONFETTI_PARTICLES.map((p) => (
            <motion.div
              key={p.id}
              className="absolute pointer-events-none"
              style={{
                left: p.left,
                width: p.width,
                height: p.height,
                backgroundColor: p.color,
                boxShadow: p.shadow,
                borderRadius: '1px',
              }}
              initial={{ y: -50, x: 0, rotate: p.rotate, opacity: 0 }}
              animate={{
                y: ['0vh', '110vh'],
                x: [0, (p.id % 2 === 0 ? 30 : -30), (p.id % 3 === 0 ? -40 : 40)],
                rotate: [p.rotate, p.rotate + 180, p.rotate + 360],
                opacity: [0, p.opacity, p.opacity, 0],
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: 'linear',
              }}
            />
          ))}
        </div>

        {/* TOP: Brand branding with trajectory curve */}
        <div className="w-full max-w-sm flex flex-col items-center text-center mt-6 relative z-20">
          {/* Authentic SVG Swooshing Orbit / Trajectory with Soccer Ball matching layout logo */}
          <div className="w-48 h-16 flex items-center justify-center relative -mb-1">
            <svg className="w-full h-full text-amber-500" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Trajectory Trailing curves */}
              <path d="M 12,65 Q 110,-10 178,32" stroke="url(#trajectoryGold)" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 32,68 Q 110,6 168,36" stroke="url(#trajectoryGold)" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
              
              {/* Football silhouette orb on top */}
              <g transform="translate(136, 12)">
                <circle cx="15" cy="15" r="14" fill="url(#soccerBallGold)" stroke="#D97706" strokeWidth="1" />
                {/* Geometrical segments matching real soccer ball */}
                <polygon points="15,6 19,10 18,15 12,15 11,10" fill="#0c1d37" opacity="0.85" />
                {/* Soccer pattern seams */}
                <line x1="15" y1="6" x2="15" y2="0" stroke="#F59E0B" strokeWidth="1" />
                <line x1="19" y1="10" x2="25" y2="8" stroke="#F59E0B" strokeWidth="1" />
                <line x1="18" y1="15" x2="22" y2="21" stroke="#F59E0B" strokeWidth="1" />
                <line x1="12" y1="15" x2="8" y2="21" stroke="#F59E0B" strokeWidth="1" />
                <line x1="11" y1="10" x2="5" y2="8" stroke="#F59E0B" strokeWidth="1" />
                
                <circle cx="7" cy="8" r="2" fill="#0c1d37" opacity="0.85" />
                <circle cx="23" cy="8" r="2" fill="#0c1d37" opacity="0.85" />
                <circle cx="15" cy="22" r="2.5" fill="#0c1d37" opacity="0.85" />
              </g>

              <defs>
                <linearGradient id="trajectoryGold" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
                  <stop offset="50%" stopColor="#FB5F1C" />
                  <stop offset="90%" stopColor="#FBBF24" />
                  <stop offset="100%" stopColor="#F59E0B" />
                </linearGradient>
                <radialGradient id="soccerBallGold" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#FEF08A" />
                  <stop offset="60%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#D97706" />
                </radialGradient>
              </defs>
            </svg>
          </div>

          {/* Premium italic font for bold Almar GOOOL title */}
          <h1 className="text-[44px] sm:text-5xl font-black italic tracking-tight uppercase leading-none mt-1">
            <span className="text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.25)] mr-1">Almar</span>
            <span className="text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.65)]">GOOOL</span>
          </h1>

          {/* Star line separator */}
          <div className="flex items-center justify-center gap-3 w-56 my-3">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-500/50 to-amber-500" />
            <span className="text-amber-400 text-sm drop-shadow-[0_0_8px_rgba(245,158,11,0.9)] animate-pulse">★</span>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-amber-500/50 to-amber-500" />
          </div>

          {/* Spaced subtitle */}
          <p className="text-[10px] sm:text-xs font-bold tracking-[0.3em] text-white uppercase leading-none">
            LA POLLA <span className="text-amber-400 font-extrabold ml-1">MUNDIALISTA</span>
          </p>
        </div>

        {/* MIDDLE: Glowing Trophy circle & Welcome Card */}
        <div className="w-full max-w-sm flex flex-col items-center text-center px-6 relative z-20 my-auto py-4">
          <div className="relative mb-5 scale-110">
            {/* Glowing arena ring in the center */}
            <div className="absolute -inset-4 rounded-full bg-blue-500/15 blur-xl opacity-90 animate-pulse" />
            <div className="relative h-20 w-20 rounded-full border-2 border-blue-500/35 shadow-[0_0_25px_rgba(59,130,246,0.5)] bg-[#030a16]/90 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-amber-400 drop-shadow-[0_2px_10px_rgba(245,158,11,0.6)]" />
            </div>
          </div>

          <h2 className="text-3xl font-black tracking-widest text-white uppercase mb-1.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            ¡BIENVENIDO!
          </h2>
          <p className="text-xs font-semibold text-slate-100 leading-relaxed max-w-[280px] drop-shadow-[0_1px_5px_rgba(0,0,0,0.9)]">
            Vive la emoción del Mundial, haz tus pronósticos y compite por <span className="text-amber-400 font-extrabold underline decoration-amber-500/30">increíbles premios</span>.
          </p>
        </div>

        {/* BOTTOM: Features Column Grid & Progress Bar loaded dynamically */}
        <div className="w-full max-w-sm flex flex-col items-center relative z-20 mt-auto">
          
          {/* Standard grid corresponding exactly to features layout */}
          <div className="grid grid-cols-5 gap-0 w-full mb-6 text-center border-t border-b border-white/10 py-4 bg-[#010510]/50 backdrop-blur-[3px] rounded-lg">
            
            <div className="col-span-1.5 flex flex-col items-center justify-center text-center">
              <ClipboardList className="h-5 w-5 text-amber-400 mb-1.5 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
              <p className="text-[8px] font-bold text-white tracking-wider uppercase leading-none mb-0.5">HAZ TUS</p>
              <p className="text-[7.5px] font-black text-amber-400 tracking-wider uppercase leading-none">PRONÓSTICOS</p>
            </div>
            
            {/* Elegant Divider 1 */}
            <div className="col-span-0.25 self-center">
              <div className="h-8 w-[1px] bg-white/15 mx-auto" />
            </div>
            
            <div className="col-span-1.5 flex flex-col items-center justify-center text-center">
              <Users className="h-5 w-5 text-amber-400 mb-1.5 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
              <p className="text-[8px] font-bold text-white tracking-wider uppercase leading-none mb-0.5">COMPITE CON</p>
              <p className="text-[7.5px] font-black text-amber-400 tracking-wider uppercase leading-none">OTROS USUARIOS</p>
            </div>

            {/* Elegant Divider 2 */}
            <div className="col-span-0.25 self-center">
              <div className="h-8 w-[1px] bg-white/15 mx-auto" />
            </div>

            <div className="col-span-1.5 flex flex-col items-center justify-center text-center">
              <Trophy className="h-5 w-5 text-amber-400 mb-1.5 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
              <p className="text-[8px] font-bold text-white tracking-wider uppercase leading-none mb-0.5">GANA</p>
              <p className="text-[7.5px] font-black text-amber-400 tracking-wider uppercase leading-none">INCREÍBLES PREMIOS</p>
            </div>
          </div>

          {/* Golden/Yellow themed Loading linear scale */}
          <div className="w-72 h-1.5 bg-[#030a16] rounded-full overflow-hidden border border-white/5 relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-150 ease-out shadow-[0_0_10px_rgba(245,158,11,0.73)] rounded-full" 
              style={{ width: `${splashProgress}%` }}
            />
          </div>

          {/* Loading status in mono-spaced typography */}
          <p className="font-mono tracking-[0.55em] text-[8.5px] text-amber-400/90 font-bold uppercase mt-3.5 select-none text-center">
            CARGANDO...
          </p>
          
          <button 
            type="button" 
            onClick={() => setShowSplash(false)}
            className="text-[9px] font-bold text-slate-400/60 hover:text-amber-400 transition-colors mt-4 opacity-50 hover:opacity-100 cursor-pointer uppercase tracking-widest"
          >
            Saltar Intro ➔
          </button>
        </div>

      </div>
    );
  }

  // If user is not logged in / registered, block and force form entry screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
        
        {/* Abstract space-themed ambient lights */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 relative z-10 backdrop-blur-md">
          {/* Header Title */}
          <div className="text-center mb-6">
            <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 items-center justify-center shadow-xl ring-2 ring-amber-400/25 mb-4">
              <Trophy className="h-7 w-7 text-slate-950" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white uppercase">
              Polla Mundialista 2026
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {authMode === 'register' ? 'Registro Obligatorio antes de ingresar' : 'Ingresa tus credenciales registradas'}
            </p>
          </div>

          {/* Form Selection tabs (Registro vs Login) */}
          <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 mb-6 text-xs gap-1">
            <button
               type="button"
               onClick={() => { setAuthMode('register'); setLoginError(''); setRegError(''); }}
               className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                 authMode === 'register' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
               }`}
            >
              Registrarse
            </button>
            <button
               type="button"
               onClick={() => { setAuthMode('login'); setLoginError(''); setRegError(''); }}
               className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                 authMode === 'login' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
               }`}
            >
              Iniciar Sesión
            </button>
          </div>

          {authMode === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-4">
              {regError && (
                <div className="bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl p-3 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="font-medium">{regError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 tracking-wider uppercase mb-1.5" id="lbl-nombre">
                  Nombre Completo *
                </label>
                <input
                  id="input-nombre"
                  type="text"
                  required
                  value={regNombre}
                  onChange={(e) => setRegNombre(e.target.value)}
                  placeholder="Nombre y Apellido"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 tracking-wider uppercase mb-1.5" id="lbl-correo">
                  Correo Electrónico *
                </label>
                <input
                  id="input-correo"
                  type="email"
                  required
                  value={regCorreo}
                  onChange={(e) => setRegCorreo(e.target.value)}
                  placeholder="usuario@correo.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 tracking-wider uppercase mb-1.5" id="lbl-cedula">
                  Número de Cédula *
                </label>
                <input
                  id="input-cedula"
                  type="text"
                  required
                  value={regCedula}
                  onChange={(e) => setRegCedula(e.target.value)}
                  placeholder="Ej: 0912345678"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">La cédula se validará según el formato ecuatoriano oficial.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 tracking-wider uppercase mb-1.5" id="lbl-empresa">
                    Empresa *
                  </label>
                  <select
                    id="select-empresa"
                    value={regEmpresa}
                    onChange={(e) => setRegEmpresa(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="PRODUMAR SA">PRODUMAR SA</option>
                    <option value="LIMBOMAR SA">LIMBOMAR SA</option>
                    <option value="LIMBOPACK SAS">LIMBOPACK SAS</option>
                    <option value="BIOGEMAR">BIOGEMAR</option>
                    <option value="SOCALMAR SA">SOCALMAR SA</option>
                    <option value="PRODUPESADA SA">PRODUPESADA SA</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 tracking-wider uppercase mb-1.5" id="lbl-localidad">
                    Localidad *
                  </label>
                  <select
                    id="select-localidad"
                    value={regLocalidad}
                    onChange={(e) => setRegLocalidad(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="San Pablo">San Pablo</option>
                    <option value="Santay">Santay</option>
                    <option value="Garzal">Garzal</option>
                    <option value="Cantagallo">Cantagallo</option>
                    <option value="Churute">Churute</option>
                    <option value="Matriz">Matriz</option>
                    <option value="Durán">Durán</option>
                  </select>
                </div>
              </div>

              <button
                id="btn-registrarse"
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition-colors mt-4 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.2)] font-black"
              >
                {loading ? 'Procesando...' : 'Comenzar a Participar →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <div className="bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl p-3 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="font-medium">{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 tracking-wider uppercase mb-1.5" id="lbl-login-correo">
                  Correo Electrónico *
                </label>
                <input
                  id="input-login-correo"
                  type="email"
                  required
                  value={loginCorreo}
                  onChange={(e) => setLoginCorreo(e.target.value)}
                  placeholder="usuario@correo.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 tracking-wider uppercase mb-1.5" id="lbl-login-cedula">
                  Número de Cédula *
                </label>
                <input
                  id="input-login-cedula"
                  type="text"
                  required
                  value={loginCedula}
                  onChange={(e) => setLoginCedula(e.target.value)}
                  placeholder="Ej: 0912345678"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginCorreo('admin@polla.com');
                    setLoginCedula('admin12345');
                    showToast('🔑 Credenciales administrador demo colocadas. ¡Recuerda haberlo registrado primero!');
                  }}
                  className="text-[11px] font-semibold text-amber-505 text-amber-400 hover:underline hover:text-amber-300 cursor-pointer"
                >
                  Autocompletar Demo Admin
                </button>
              </div>

              <button
                id="btn-login"
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm transition-colors mt-2 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.2)] font-black"
              >
                {loading ? 'Ingresando...' : 'Iniciar Sesión →'}
              </button>
            </form>
          )}

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden selection:bg-amber-500 selection:text-slate-950">
      
      {/* Toast warnings */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-amber-500/40 text-amber-300 shadow-2xl px-5 py-3 rounded-xl flex items-center gap-3 backdrop-blur-md animate-fade-in">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="font-semibold text-xs">{toast}</span>
        </div>
      )}

      {/* Main app header */}
      <header className="relative border-b border-slate-900 bg-slate-900/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-lg">
              <Trophy className="h-5 w-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white uppercase">
                  Polla Mundialista 2026
                </h1>
                <span className="text-[9px] font-bold tracking-widest uppercase bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20">
                  FIFA WC
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Participante: <span className="font-bold text-amber-400">{currentUser.nombreCompleto}</span> ({currentUser.correo && `${currentUser.correo} • `}{currentUser.empresa} - {currentUser.localidad})
              </p>
            </div>
          </div>

          {/* User operations */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {currentUser.role === 'admin' && (
              <span className="text-[10px] font-bold uppercase bg-rose-600 text-white px-2.5 py-1 rounded-full animate-pulse border border-rose-500">
                Rol: Administrador
              </span>
            )}
            
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-850 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-400" />
              <span>Cerrar Sesión</span>
            </button>
          </div>

        </div>
      </header>

      {/* Primary Navigation tabs */}
      <div className="bg-slate-900/20 border-b border-slate-900 py-3">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          
          <nav className="flex flex-wrap items-center bg-slate-950 p-1 rounded-xl border border-slate-850 w-full lg:w-auto">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'info' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gift className="h-4 w-4" />
              <span>Premios y Reglas</span>
            </button>

            <button
              onClick={() => setActiveTab('groups')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'groups' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TableIcon className="h-4 w-4" />
              <span>Fase de Grupos</span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'calendar' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Mis Pronósticos</span>
            </button>

            <button
              onClick={() => setActiveTab('bracket')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'bracket' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span>Llaves Eliminatorias</span>
            </button>

            <button
              onClick={() => setActiveTab('awards')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'awards' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="h-4 w-4" />
              <span>Premios FIFA</span>
            </button>

            <button
              onClick={() => setActiveTab('ranking')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ranking' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span>Ranking General</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'profile' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Mi Perfil</span>
            </button>

            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all bg-rose-600/10 border border-rose-500/20 text-rose-400 ${
                  activeTab === 'admin' ? 'bg-rose-600 text-white' : 'hover:bg-rose-950/20'
                }`}
              >
                <Sliders className="h-4 w-4" />
                <span>Panel Administrativo</span>
              </button>
            )}
          </nav>

          {/* Quick random generator */}
          {activeTab === 'calendar' && (
            <button
              onClick={handleRandomFillPendingPredictions}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-505 border border-indigo-500/20 text-indigo-400 rounded-lg text-xs font-bold transition-colors"
            >
              <Dice5 className="h-3.5 w-3.5" />
              <span>Simular Vacíos</span>
            </button>
          )}

        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* ==================== TAB: RULES & PRIZES ==================== */}
        {activeTab === 'info' && (
          <div className="space-y-8 max-w-5xl mx-auto">
            {/* Elegant header banner */}
            <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-r from-[#030d22] via-[#0b214a] to-[#04112c] p-8 sm:p-10 shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black tracking-widest uppercase">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  MUNDIAL 2026 EN ALMAR
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase leading-tight">
                  🌍⚽ ¡La fiesta mundialista llega a Almar! ⚽🌍
                </h1>
                <p className="text-sm sm:text-base text-slate-300 max-w-3xl font-medium leading-relaxed">
                  🏆 Es tu momento de demostrar que sabes de fútbol. Predice los resultados de los partidos y si aciertas, ¡entras al sorteo de premios!
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('calendar')}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.25)] flex items-center gap-2 cursor-pointer"
                  >
                    <span>Comenzar mis Pronósticos</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bento Grid highlighting features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Card 1: What can you win */}
              <div className="bg-[#030a16]/80 p-6 sm:p-8 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4 backdrop-blur-md">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Gift className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">🎽 ¿Qué puedes ganar?</h3>
                    <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mt-0.5">Sorteos y sorpresas de la semana</p>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                    Camisetas oficiales de la <strong className="text-white font-bold">Selección Ecuatoriana 🇪🇨</strong> y sorpresas mundialistas para los que más acierten en la semana.
                  </p>
                </div>
                <div className="bg-[#020710] border border-white/5 p-3 rounded-xl flex items-center gap-2 text-slate-400 text-xs font-semibold">
                  <span>✨</span>
                  <span>¡Cada semana habrá un ganador!</span>
                </div>
              </div>

              {/* Card 2: How it works */}
              <div className="bg-[#030a16]/80 p-6 sm:p-8 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4 backdrop-blur-md">
                <div className="space-y-3">
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">📋 ¿Cómo funciona?</h3>
                    <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mt-0.5">Paso a paso para participar</p>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                    Ingresa tus datos, predice cuántos goles marca cada equipo en el tiempo reglamentario (1er y 2do tiempo ordinario de 90&apos; minutos, no aplica los tiempos extra ni penales) y espera los resultados.
                  </p>
                </div>
                <div className="bg-[#020710] border border-white/5 p-3 rounded-xl flex items-center gap-2 text-slate-400 text-xs font-semibold">
                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Tienes hasta antes del pitazo inicial para participar. ¡No te quedes fuera!</span>
                </div>
              </div>

            </div>

            {/* Bottom details & high-fidelity brand callout banner */}
            <div className="bg-gradient-to-r from-amber-500/10 via-[#040f21] to-[#040f21] border border-amber-500/20 p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-slate-300">
              <Trophy className="h-10 w-10 text-amber-400 shrink-0" />
              <div className="space-y-1 text-center sm:text-left flex-1">
                <p className="text-sm font-bold text-white uppercase tracking-wide">🔥 ¡Vive la fiesta mundialista en Almar! 🔥</p>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  Demuestra tu conocimiento del fútbol mundial, pronostica cada fecha con precisión y únete al gran orgullo de vivir el torneo con todo el equipo de Almar.
                </p>
              </div>
              <div className="shrink-0 pt-2 sm:pt-0">
                <button
                  onClick={() => setActiveTab('ranking')}
                  className="px-4 py-2 bg-[#08152e] hover:bg-[#0c224a] text-amber-400 text-xs font-bold uppercase tracking-wider rounded-lg border border-amber-500/20 transition-colors"
                >
                  Ver Sistema de Puntos
                </button>
              </div>
            </div>

            {/* Footer citation */}
            <div className="pt-2 text-center select-none">
              <div className="flex items-center justify-center gap-2 text-[10px] tracking-[0.24em] text-slate-400/90 font-bold uppercase">
                <span>En Almar vivimos el Mundial 2026</span>
                <span className="text-amber-500 font-extrabold">|</span>
                <span>Bienestar Grupo Almar</span>
              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB: GROUPS & STANDINGS ==================== */}
        {activeTab === 'groups' && (
          <div className="space-y-8">
            
            {isGroupStageSelectionsLocked() && (
              <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20 shrink-0">
                  <Lock className="h-5 w-5 text-red-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm uppercase text-red-400 tracking-wider">
                    Posiciones de Fase de Grupos Bloqueadas
                  </h4>
                  <p className="text-xs text-slate-400">
                    Las clasificaciones de primer y segundo lugar de cada grupo, así como los mejores terceros lugares, ya no pueden ser modificados. El primer encuentro del Mundial 2026 inicia en menos de 1 hora o ya ha comenzado (11 de Junio, 14:00).
                  </p>
                </div>
              </div>
            )}

            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
                  <TableIcon className="h-5 w-5 text-amber-500" />
                  Visualización y Clasificación de la Fase de Grupos
                </h2>
                <p className="text-xs text-slate-400 max-w-2xl">
                  Visualiza los 12 grupos del Mundial 2026. Los puntos se calculan automáticamente de tus pronósticos. También puedes seleccionar manualmente a los clasificados a Dieciseisavos de Final.
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleAutoClassifyWithStandings}
                  disabled={isGroupStageSelectionsLocked()}
                  className={`flex items-center gap-1.5 px-4 py-2.5 font-bold text-xs rounded-xl transition-colors cursor-pointer ${
                    isGroupStageSelectionsLocked()
                      ? 'bg-slate-800 text-slate-500 border border-slate-750 opacity-50 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                  }`}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Autocalcular del Standing</span>
                </button>
              </div>
            </div>

            {/* Grid of 12 Groups */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {GROUPS.map((gId) => {
                const groupTeams = TEAMS.filter((t) => t.group === gId);
                const groupStandings = standings[gId] || [];

                return (
                  <div key={gId} className="bg-slate-900/60 border border-slate-900 rounded-2xl p-5 space-y-4">
                    
                    {/* Header Group */}
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                      <h3 className="font-extrabold text-sm tracking-wider uppercase text-amber-400">
                        Grupo {gId}
                      </h3>
                      <span className="text-[10px] text-slate-500 font-bold">Mundial 2026</span>
                    </div>

                    {/* Table Group */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-sans">
                        <thead>
                          <tr className="text-[10px] uppercase text-slate-500 font-semibold border-b border-slate-850">
                            <th className="py-1">Equipo</th>
                            <th className="py-1 text-center">PTS</th>
                            <th className="py-1 text-center">DG</th>
                            <th className="py-1 text-center">GF</th>
                            <th className="py-1 text-center">GC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupStandings.map((st, idx) => {
                            const team = TEAMS.find(t => t.id === st.teamId);
                            if (!team) return null;

                            return (
                              <tr key={team.id} className="border-b border-slate-900/30 py-1.5">
                                <td className="py-1.5 font-semibold text-slate-200 flex items-center gap-1.5 truncate">
                                  <span className="text-xs">{idx + 1}</span>
                                  <img src={getTeamFlagUrl(team.id)} className="w-5 h-3.5 object-cover rounded shadow-sm border border-slate-800 shrink-0" alt="" referrerPolicy="no-referrer" />
                                  <span className="truncate">{team.name}</span>
                                </td>
                                <td className="py-1.5 text-center font-bold text-amber-400">{st.points}</td>
                                <td className={`py-1.5 text-center font-semibold ${st.goalDifference > 0 ? 'text-teal-400' : (st.goalDifference < 0 ? 'text-rose-450 text-rose-450 hover:bg-rose-600' : 'text-slate-400')}`}>
                                  {st.goalDifference > 0 ? `+${st.goalDifference}` : st.goalDifference}
                                </td>
                                <td className="py-1.5 text-center text-slate-400">{st.goalsFor}</td>
                                <td className="py-1.5 text-center text-slate-400">{st.goalsAgainst}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Manual classification overridden dropdowns */}
                    {/* Manual classification overridden dropdowns */}
                    {(() => {
                      const isGroupOverriddenInDb = !!(
                        userPredictions[`group_override_first_${gId}`]?.predictedWinnerId &&
                        userPredictions[`group_override_second_${gId}`]?.predictedWinnerId &&
                        userPredictions[`group_override_third_${gId}`]?.predictedWinnerId
                      );
                      const isCompleted = isGroupOverriddenInDb || !!(manualFirstPlaces[gId] && manualSecondPlaces[gId] && manualThirdsByGroup[gId]);
                      const isLockedByAutoSave = isCompleted && (!unlockedGroups[gId] || isGroupOverriddenInDb);
                      const isDisabled = isGroupStageSelectionsLocked() || isLockedByAutoSave;

                      return (
                        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 space-y-2 text-xs">
                          <div className="font-bold text-slate-300 uppercase text-[9px] tracking-wider mb-1.5 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              {(isGroupStageSelectionsLocked() || isLockedByAutoSave) && <Lock className="h-3 w-3 text-red-400 shrink-0" />}
                              <span>{isGroupOverriddenInDb ? '🔒 Registro Guardado en Base de Datos' : (isLockedByAutoSave ? '🔒 Gp. Guardado y Bloqueado' : 'Selección Manual (Clasificados)')}</span>
                            </div>
                            {isCompleted && !isGroupStageSelectionsLocked() && !isGroupOverriddenInDb && (
                              <button
                                type="button"
                                onClick={() => {
                                  const currentVal = !unlockedGroups[gId];
                                  setUnlockedGroups(prev => ({ ...prev, [gId]: currentVal }));
                                  if (!currentVal) {
                                    // Lock triggers saving
                                    checkAndSaveGroup(gId, manualFirstPlaces[gId] || '', manualSecondPlaces[gId] || '', manualThirdsByGroup[gId] || '');
                                  }
                                }}
                                className="text-[9px] text-amber-500 hover:text-amber-400 font-bold underline cursor-pointer bg-transparent border-none p-0"
                              >
                                {unlockedGroups[gId] ? '💾 Bloquear' : '✏️ Cambiar'}
                              </button>
                            )}
                          </div>
                          
                          {(() => {
                            const firstSelected = manualFirstPlaces[gId] || '';
                            const secondSelected = manualSecondPlaces[gId] || '';
                            const thirdSelected = manualThirdsByGroup[gId] || '';

                            const firstOptions = groupTeams.filter(t => t.id !== secondSelected && t.id !== thirdSelected);
                            const secondOptions = groupTeams.filter(t => t.id !== firstSelected && t.id !== thirdSelected);
                            const thirdOptions = groupTeams.filter(t => t.id !== firstSelected && t.id !== secondSelected);

                            return (
                              <>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-slate-400">1er Lugar:</span>
                                  <select
                                    disabled={isDisabled}
                                    value={firstSelected}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setManualFirstPlaces(prev => {
                                        const updated = { ...prev, [gId]: val };
                                        checkAndSaveGroup(gId, val, secondSelected, thirdSelected);
                                        return updated;
                                      });
                                    }}
                                    className={`bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-400 font-bold focus:outline-none transition-opacity ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <option value="">-- Selecciona --</option>
                                    {firstOptions.map(t => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
                                  </select>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-slate-400">2do Lugar:</span>
                                  <select
                                    disabled={isDisabled}
                                    value={secondSelected}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setManualSecondPlaces(prev => {
                                        const updated = { ...prev, [gId]: val };
                                        checkAndSaveGroup(gId, firstSelected, val, thirdSelected);
                                        return updated;
                                      });
                                    }}
                                    className={`bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-400 font-bold focus:outline-none transition-opacity ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <option value="">-- Selecciona --</option>
                                    {secondOptions.map(t => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
                                  </select>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-slate-400 font-semibold text-amber-400/80">3er Lugar:</span>
                                  <select
                                    disabled={isDisabled}
                                    value={thirdSelected}
                                    onChange={(e) => {
                                      if (isGroupStageSelectionsLocked()) {
                                        showToast('🔒 El registro de posiciones de la fase de grupos está bloqueado. El primer partido inicia en menos de 1 hora.');
                                        return;
                                      }
                                      const val = e.target.value;
                                      const oldTeamId = thirdSelected;
                                      
                                      let finalThirdVal = '';
                                      if (val === 'no_aplica') {
                                        finalThirdVal = 'no_aplica';
                                        setManualThirdsByGroup(prev => ({ ...prev, [gId]: 'no_aplica' }));
                                        if (oldTeamId) {
                                          setManualThirdPlaces(prev => prev.filter(tid => tid !== oldTeamId));
                                        }
                                      } else if (!val) {
                                        finalThirdVal = '';
                                        setManualThirdsByGroup(prev => ({ ...prev, [gId]: '' }));
                                        if (oldTeamId) {
                                          setManualThirdPlaces(prev => prev.filter(tid => tid !== oldTeamId));
                                        }
                                      } else {
                                        const filteredThirds = manualThirdPlaces.filter(tid => tid !== oldTeamId);
                                        if (filteredThirds.length >= 8) {
                                          showToast('⚠️ Solo se permiten 8 mejores terceros clasificados. Cambie otro grupo a "No aplica" o deselecciónelo antes.');
                                          return;
                                        }
                                        finalThirdVal = val;
                                        setManualThirdsByGroup(prev => ({ ...prev, [gId]: val }));
                                        setManualThirdPlaces(prev => {
                                          const updated = prev.filter(tid => tid !== oldTeamId);
                                          if (!updated.includes(val)) {
                                            return [...updated, val];
                                          }
                                          return updated;
                                        });
                                      }

                                      checkAndSaveGroup(gId, firstSelected, secondSelected, finalThirdVal);
                                    }}
                                    className={`bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-amber-400 font-bold focus:outline-none transition-opacity ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <option value="">-- Selecciona --</option>
                                    <option value="no_aplica">❌ No aplica</option>
                                    {thirdOptions.map(t => <option key={t.id} value={t.id}>{t.flag} {t.name}</option>)}
                                  </select>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      );
                    })()}

                  </div>
                );
              })}
            </div>

            {/* Selecting best thirds list */}
            <div className="bg-slate-900/60 border border-slate-900 p-6 rounded-2xl space-y-4">
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                  Selección de los mejores Terceros Lugares (Exactamente 8 clasificados)
                </h3>
                <p className="text-xs text-slate-400">
                  El mundial requiere clasificar los 8 mejores terceros lugares de los 12 grupos. Configúralos para armar las llaves eliminatorias correspondientes.
                </p>
              </div>

              {/* Grid of options */}
              {(() => {
                const candidates = GROUPS.map((gId) => {
                  const thirdTeamId = manualThirdsByGroup[gId];
                  if (!thirdTeamId || thirdTeamId === 'no_aplica') return null;
                  const team = TEAMS.find(t => t.id === thirdTeamId);
                  if (!team) return null;
                  return { gId, team, thirdTeamId };
                }).filter(Boolean);

                if (candidates.length === 0) {
                  return (
                    <div className="text-center py-6 text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                      ⚠️ Selecciona algún equipo como "3er Lugar" en las tarjetas de grupos para habilitar su postulación aquí.
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
                    {candidates.map((item) => {
                      if (!item) return null;
                      const { gId, team, thirdTeamId } = item;
                      const isSelected = manualThirdPlaces.includes(team.id);

                      const groupStandings = standings[gId];
                      const teamStanding = groupStandings?.find(s => s.teamId === thirdTeamId);
                      const points = teamStanding ? teamStanding.points : 0;
                      const goalDifference = teamStanding ? teamStanding.goalDifference : 0;

                      const isButtonDisabled = isGroupStageSelectionsLocked();

                      return (
                        <button
                          key={team.id}
                          disabled={isButtonDisabled}
                          onClick={() => {
                            if (isGroupStageSelectionsLocked()) {
                              showToast('🔒 El registro de posiciones de la fase de grupos está bloqueado. El primer partido inicia en menos de 1 hora.');
                              return;
                            }

                            let updatedList: string[];
                            if (isSelected) {
                              updatedList = manualThirdPlaces.filter(tid => tid !== team.id);
                            } else {
                              if (manualThirdPlaces.length >= 8) {
                                showToast('⚠️ Solo se permiten 8 mejores terceros.');
                                return;
                              }
                              updatedList = [...manualThirdPlaces, team.id];
                            }
                            setManualThirdPlaces(updatedList);
                            handleSaveBestThirds(updatedList);

                            // Auto-fill "no_aplica" for the remaining groups if exactly 8 thirds are selected
                            if (updatedList.length === 8) {
                              const newThirdsByGroup = { ...manualThirdsByGroup };
                              const payloadToSave: Record<string, any> = {};

                              GROUPS.forEach((groupCode) => {
                                const currentThirdTeamId = manualThirdsByGroup[groupCode] || '';
                                if (currentThirdTeamId !== 'no_aplica') {
                                  if (!currentThirdTeamId || !updatedList.includes(currentThirdTeamId)) {
                                    newThirdsByGroup[groupCode] = 'no_aplica';

                                    const firstVal = manualFirstPlaces[groupCode] || '';
                                    const secondVal = manualSecondPlaces[groupCode] || '';

                                    // Only save if first and second are already registered/selected!
                                    if (firstVal && secondVal) {
                                      payloadToSave[`group_override_first_${groupCode}`] = {
                                        predictedHome: '0',
                                        predictedAway: '0',
                                        predictedWinnerId: firstVal,
                                        completed: true
                                      };
                                      payloadToSave[`group_override_second_${groupCode}`] = {
                                        predictedHome: '0',
                                        predictedAway: '0',
                                        predictedWinnerId: secondVal,
                                        completed: true
                                      };
                                      payloadToSave[`group_override_third_${groupCode}`] = {
                                        predictedHome: '0',
                                        predictedAway: '0',
                                        predictedWinnerId: 'no_aplica',
                                        completed: true
                                      };
                                    }
                                  }
                                }
                              });

                              setManualThirdsByGroup(newThirdsByGroup);

                              // Save group overrides to DB
                              if (Object.keys(payloadToSave).length > 0 && currentUser) {
                                fetch(`/api/predictions/${currentUser.id}`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ predictions: payloadToSave })
                                })
                                .then(res => res.json())
                                .then(data => {
                                  if (data.success) {
                                    setUserPredictions(prev => ({ ...prev, ...payloadToSave }));
                                  }
                                })
                                .catch(err => console.error('Error auto-saving group thirds:', err));
                              }
                            }
                          }}
                          className={`p-3 border rounded-xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-amber-500/10 border-amber-500 text-amber-400 font-bold shadow-md'
                              : 'bg-slate-950/60 border-slate-850 text-slate-300 hover:border-slate-700'
                          } ${isButtonDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <img src={getTeamFlagUrl(team.id)} className="w-10 h-7 object-cover rounded shadow border border-slate-800" alt="" referrerPolicy="no-referrer" />
                          <span className="text-[10px] truncate w-full font-semibold">{team.name}</span>
                          <span className="text-[9px] text-slate-500 font-mono">Gp. {gId} | Pts: {points} | DG: {goalDifference}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              <div className="text-right text-xs font-bold text-amber-400">
                Seleccionados de terceros: {manualThirdPlaces.length} / 8
              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB: MIS PRONOSTICOS / CALENDAR ==================== */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            
            {/* Control Filters panel */}
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-900 space-y-4">
              
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-850 pb-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-amber-500" />
                    Mis Resultados Pronosticados
                  </h2>
                  <p className="text-xs text-slate-400">
                    Sustenta tus predicciones. Los partidos completados e ingresados se bloquearán para edición una vez guardados.
                  </p>
                </div>

                {/* Sub Tab selection between Pending and Registered! */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-850 self-start lg:self-auto">
                  <button
                    onClick={() => setCalendarSubTab('pending')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      calendarSubTab === 'pending' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Pendientes</span>
                    <span className="bg-amber-900/20 text-amber-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                      {combinedMatches.filter(m => !m.completed).length}
                    </span>
                  </button>

                  <button
                    onClick={() => setCalendarSubTab('completed')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      calendarSubTab === 'completed' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Registrados</span>
                    <span className="bg-teal-900/20 text-teal-400 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                      {combinedMatches.filter(m => m.completed).length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Dynamic Filtering */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Clasificación / Etapa</label>
                  <select
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value as StageType | 'all')}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="all">Ver todas las etapas</option>
                    <option value="group">Fase de Grupos</option>
                    <option value="1/16">1/16 Final (Round of 32)</option>
                    <option value="1/8">1/8 Final (Round of 16)</option>
                    <option value="1/4">1/4 Final (Quarter-Finals)</option>
                    <option value="1/2">Semifinales</option>
                    <option value="third_place">Tercer Puesto</option>
                    <option value="final">La Gran Final</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Filtrar por Grupo (A-L)</label>
                  <select
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="all">Todos los grupos</option>
                    {GROUPS.map(g => <option key={g} value={g}>Grupo {g}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Semana de Partidos</label>
                  <select
                    value={weekFilter}
                    onChange={(e) => setWeekFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="all">Ver todas las Semanas</option>
                    <option value="1">Semana 1 (11 Jun - 14 Jun)</option>
                    <option value="2">Semana 2 (15 Jun - 21 Jun)</option>
                    <option value="3">Semana 3 (22 Jun - 28 Jun)</option>
                    <option value="4">Semana 4 (29 Jun - 05 Jul)</option>
                    <option value="5">Semana 5 (06 Jul - 12 Jul)</option>
                    <option value="6">Semana 6 (13 Jul - 19 Jul)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Filtrar por Fecha</label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="all">Ver todas las Fechas ({uniqueMatchDates.length})</option>
                    {uniqueMatchDates.map((d) => (
                      <option key={d} value={d}>
                        {formatDateFriendly(d)} ({d})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Buscar por país</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Escribe un país..."
                      value={searchTeam}
                      onChange={(e) => setSearchTeam(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl pl-8 pr-3 py-2 text-xs text-white"
                    />
                    <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>

            </div>

            {/* List of matches */}
            <div className="space-y-4">
              {filteredMatches.length === 0 ? (
                <div className="bg-slate-900 bg-opacity-20 border border-slate-900 rounded-2xl py-12 px-4 text-center text-slate-500 text-xs">
                  Aún no tienes ningún partido en esta categoría ({calendarSubTab === 'pending' ? 'Pendientes' : 'Registrados'}).
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from(new Set(filteredMatches.map(m => getMatchWeek(m.date)))).sort().map(weekNumber => {
                    const weekMatches = filteredMatches.filter(m => getMatchWeek(m.date) === weekNumber);
                    return (
                      <div key={weekNumber} className="col-span-1 md:col-span-2 space-y-4 mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-sm font-extrabold text-white uppercase tracking-widest bg-slate-800 px-4 py-2 rounded-lg shadow-md border border-slate-700 w-full flex justify-between">
                            <span>Semana {weekNumber}</span>
                            <span className="text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] rounded flex items-center">{weekMatches.length} partidos</span>
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {weekMatches.map((m) => {
                            const homeRes = resolveTeamWithManualOverrides(m.homeTeamId);
                            const awayRes = resolveTeamWithManualOverrides(m.awayTeamId);

                            const isHomePlaceholder = 'placeholder' in homeRes;
                            const isAwayPlaceholder = 'placeholder' in awayRes;

                            const pHome = userPredictions[m.id]?.predictedHome || '';
                            const pAway = userPredictions[m.id]?.predictedAway || '';
                            const pWinnerId = userPredictions[m.id]?.predictedWinnerId;

                            // Match locked criteria (kickoff rules, weekly lock or completed)
                            const isTimeLocked = isMatchLockedForTime(m);
                            const isWeeklyLocked = isMatchWeeklyLocked(m.date);
                            const hasOfficialResult = m.homeScore !== undefined;
                            const isLocked = m.completed || isTimeLocked || isWeeklyLocked || hasOfficialResult;

                            return (
                              <div 
                                key={m.id} 
                                className={`bg-slate-905 border rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all relative ${
                                  m.completed 
                                    ? 'bg-emerald-950/15 border-emerald-900/40 hover:border-emerald-900/60' 
                                    : (isWeeklyLocked ? 'bg-slate-950 border-slate-900 opacity-60' : (isTimeLocked ? 'bg-rose-950/15 border-rose-900/40' : 'bg-slate-900/60 border-slate-900 hover:border-slate-800'))
                                }`}
                              >
                                
                                {/* Match header info */}
                                <div className="flex items-center justify-between text-[10px] border-b border-slate-900 pb-2">
                                  <span className="font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest">
                                    {m.stage === 'group' ? `Grupo ${m.group}` : (m.stage === '1/16' ? 'Round of 32' : m.stage)}
                                  </span>
                                  
                                  <div className="flex items-center gap-1 text-slate-400">
                                    <Clock className="h-3 w-3" />
                                    <span>{m.date} a las {m.time} UTC</span>
                                  </div>
                                </div>

                                {m.homeScore !== undefined && m.awayScore !== undefined && (
                                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[10px] text-center uppercase tracking-wider py-1 rounded-xl">
                                    Resultado Oficial: {m.homeScore} - {m.awayScore}
                                  </div>
                                )}

                                {/* Predict Fields Grid */}
                                <div className="grid grid-cols-7 items-center gap-2">
                                  
                                  {/* Home country info */}
                                  <div className="col-span-2 text-right space-y-1 overflow-hidden flex flex-col items-end">
                                    {isHomePlaceholder ? (
                                      <span className="text-2xl block">🏳️</span>
                                    ) : (
                                      <img src={getTeamFlagUrl(homeRes.id)} className="w-10 h-7 object-cover rounded shadow-sm border border-slate-800" alt="" referrerPolicy="no-referrer" />
                                    )}
                                    <span className={`text-xs font-bold block truncate max-w-full ${isHomePlaceholder ? 'text-slate-500 italic' : 'text-slate-100'}`}>
                                      {isHomePlaceholder ? homeRes.text : homeRes.name}
                                    </span>
                                  </div>

                                  {/* Predict score inputs */}
                                  <div className="col-span-3 flex items-center justify-center gap-1.5 bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                                    <input
                                      type="text"
                                      disabled={isLocked}
                                      value={pHome}
                                      onChange={(e) => handleLocalPredictionChange(m.id, 'home', e.target.value)}
                                      placeholder="-"
                                      className="w-10 text-center bg-slate-900 border border-slate-800 rounded-lg py-1 text-xs text-white font-bold font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
                                    />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">VS</span>
                                    <input
                                      type="text"
                                      disabled={isLocked}
                                      value={pAway}
                                      onChange={(e) => handleLocalPredictionChange(m.id, 'away', e.target.value)}
                                      placeholder="-"
                                      className="w-10 text-center bg-slate-900 border border-slate-800 rounded-lg py-1 text-xs text-white font-bold font-mono focus:ring-1 focus:ring-amber-500 focus:outline-none disabled:opacity-50"
                                    />
                                  </div>

                                  {/* Away country info */}
                                  <div className="col-span-2 text-left space-y-1 overflow-hidden flex flex-col items-start">
                                    {isAwayPlaceholder ? (
                                      <span className="text-2xl block">🏳️</span>
                                    ) : (
                                      <img src={getTeamFlagUrl(awayRes.id)} className="w-10 h-7 object-cover rounded shadow-sm border border-slate-800" alt="" referrerPolicy="no-referrer" />
                                    )}
                                    <span className={`text-xs font-bold block truncate max-w-full ${isAwayPlaceholder ? 'text-slate-500 italic' : 'text-slate-100'}`}>
                                      {isAwayPlaceholder ? awayRes.text : awayRes.name}
                                    </span>
                                  </div>

                                </div>

                                {/* Tie check for knockout games */}
                                {m.type === 'knockout' && pHome !== '' && pAway !== '' && parseInt(pHome, 10) === parseInt(pAway, 10) && (
                                  <div className="bg-slate-950 p-2 rounded-xl text-center space-y-1.5 border border-slate-850">
                                    <div className="text-[9px] text-amber-400 font-bold uppercase tracking-wide">Empate - Selecciona el Ganador por Penales:</div>
                                    <div className="flex justify-center gap-3">
                                      <button
                                       disabled={isLocked}
                                       onClick={() => handleLocalWinnerDecider(m.id, (homeRes as any).id || '')}
                                       className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                         pWinnerId === ((homeRes as any).id || '') ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:text-white'
                                       }`}
                                      >
                                        {isHomePlaceholder ? (
                                          '🏳️ Local'
                                        ) : (
                                          <span className="flex items-center gap-1 justify-center">
                                            <img src={getTeamFlagUrl(homeRes.id)} className="w-4 h-3 object-cover rounded" alt="" referrerPolicy="no-referrer" />
                                            <span>{homeRes.name}</span>
                                          </span>
                                        )}
                                      </button>
                                      <button
                                       disabled={isLocked}
                                       onClick={() => handleLocalWinnerDecider(m.id, (awayRes as any).id || '')}
                                       className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                         pWinnerId === ((awayRes as any).id || '') ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:text-white'
                                       }`}
                                      >
                                        {isAwayPlaceholder ? (
                                          '🏳️ Visitante'
                                        ) : (
                                          <span className="flex items-center gap-1 justify-center">
                                            <img src={getTeamFlagUrl(awayRes.id)} className="w-4 h-3 object-cover rounded" alt="" referrerPolicy="no-referrer" />
                                            <span>{awayRes.name}</span>
                                          </span>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Match Action Saves / Lock Indicators */}
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-900/60 text-xs text-slate-100">
                                  {isWeeklyLocked ? (
                                    <div className="flex items-center gap-1 font-bold text-red-400 bg-red-950/25 px-2.5 py-1 rounded-lg border border-red-900/40">
                                      <Lock className="h-3.5 w-3.5 shrink-0" />
                                      <span>Semana bloqueada por Admin</span>
                                    </div>
                                  ) : isLocked ? (
                                    <div className={`flex items-center gap-1 font-bold ${m.completed ? 'text-emerald-400' : 'text-rose-400'}`}>
                                      <Lock className="h-3.5 w-3.5 shrink-0" />
                                      <span>{m.completed ? 'Pronóstico Registrado (Bloqueado)' : 'Cerrado por inicio del partido'}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 font-semibold text-amber-500 bg-amber-500/5 px-2 py-1 rounded-lg border border-amber-500/10">
                                      <Unlock className="h-3.5 w-3.5 shrink-0" />
                                      <span>Editable</span>
                                    </div>
                                  )}

                                  {!isLocked && (
                                    <button
                                      onClick={() => handleSavePrediction(m.id, m.date, m.time)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check className="h-3.5 w-3.5 shrink-0" />
                                      <span>Guardar</span>
                                    </button>
                                  )}
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB: BRACKET MAP (LLAVES) ==================== */}
        {activeTab === 'bracket' && (
          <div className="space-y-6">
            
            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  Cuadro Eliminatorio Automático de Partidos
                </h2>
                <p className="text-xs text-slate-400 max-w-2xl">
                  Armado y simulación automática del bracket siguiendo las posiciones clasificatorias configuradas de forma oficial.
                </p>
              </div>

              <div className="text-xs bg-slate-950 px-4 py-2 rounded-xl border border-slate-850 flex items-center gap-2">
                <Info className="h-4 w-4 text-amber-400 shrink-0" />
                <span>Modifica los marcadores y haz clic en Guardar directamente en el cuadro para avanzar las llaves.</span>
              </div>
            </div>

            {!isGroupStageSelectionsCompleted && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start gap-4 shadow-lg shadow-amber-500/5">
                <div className="bg-amber-500/20 p-3 rounded-xl shrink-0">
                  <ShieldAlert className="h-6 w-6 text-amber-400" />
                </div>
                <div className="space-y-1.5 flex-1 text-center sm:text-left">
                  <h3 className="font-bold text-base text-amber-400 tracking-tight flex items-center justify-center sm:justify-start gap-2">
                    Fase de grupos por definir
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                    Para habilitar y pronosticar los partidos de las llaves eliminatorias, primero debes registrar las posiciones finales del <strong>1er lugar, 2do lugar y mejores terceros</strong> para todos los grupos en la sección de <strong>Fase de Grupos</strong>.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('groups')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors shadow-md cursor-pointer"
                    >
                      Ir a Fase de Grupos
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Layout representation of World Cup Brackets */}
            <div className="flex overflow-x-auto gap-8 py-6 px-2">
              
              {/* STAGE: 1/16 (Round of 32) */}
              <div className="min-w-[240px] flex flex-col gap-6 justify-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center border-b border-slate-900 pb-2">Dieciseisavos (1/16)</div>
                {combinedMatches.filter(m => m.stage === '1/16').map((m) => renderBracketMatchCard(m))}
              </div>

              {/* STAGE: 1/8 (Round of 16) */}
              <div className="min-w-[240px] flex flex-col gap-6 justify-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center border-b border-slate-900 pb-2">Octavos de Final (1/8)</div>
                {combinedMatches.filter(m => m.stage === '1/8').map((m) => renderBracketMatchCard(m))}
              </div>

              {/* STAGE: 1/4 (Quarter-finals) */}
              <div className="min-w-[240px] flex flex-col gap-12 justify-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center border-b border-slate-900 pb-2">Cuartos de Final (1/4)</div>
                {combinedMatches.filter(m => m.stage === '1/4').map((m) => renderBracketMatchCard(m))}
              </div>

              {/* STAGE: 1/2 (Semifinals) */}
              <div className="min-w-[240px] flex flex-col gap-24 justify-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center border-b border-slate-900 pb-2">Semifinales</div>
                {combinedMatches.filter(m => m.stage === '1/2').map((m) => renderBracketMatchCard(m))}
              </div>

              {/* STAGE: FINAL (La Gran Final & Campeón) */}
              <div className="min-w-[260px] flex flex-col gap-6 justify-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center border-b border-slate-900 pb-2">Gran Final y Podio</div>
                
                {combinedMatches.filter(m => m.stage === 'final').map((m) => {
                  const winnerId = getKnockoutWinnerIdWithOverrides(m);
                  const champion = winnerId ? TEAMS.find(t => t.id === winnerId) : null;

                  return (
                    <div key={m.id} className="space-y-6">
                      
                      {/* Champion Crown box */}
                      {champion && (
                        <div className="bg-gradient-to-tr from-amber-500 to-yellow-300 p-4 rounded-xl text-slate-950 text-center space-y-1 shadow-[0_0_20px_rgba(245,158,11,0.3)] border border-amber-400 flex flex-col items-center justify-center">
                          <Crown className="h-6 w-6 text-slate-950 fill-slate-950/20 mb-1" />
                          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-950">Tu Campeón Pronosticado:</div>
                          <img src={getTeamFlagUrl(champion.id)} className="w-12 h-8 object-cover rounded-md shadow-md border border-amber-600/30 my-1.5" alt="" referrerPolicy="no-referrer" />
                          <div className="text-sm font-black uppercase tracking-tight text-slate-950">{champion.name}</div>
                        </div>
                      )}

                      {/* Final block */}
                      {renderBracketMatchCard(m)}

                    </div>
                  );
                })}
              </div>

            </div>

          </div>
        )}

        {/* ==================== TAB: GENERAL RANKING (PUNTAJES) ==================== */}
        {activeTab === 'ranking' && (
          <div className="space-y-6">
            
            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-amber-500" />
                  Clasificación y Puntos Generales
                </h2>
                <p className="text-xs text-slate-400">
                  La tabla general se actualiza de forma automática con los resultados oficiales ingresados por el administrador.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowPointsManual(!showPointsManual)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 border text-xs font-bold rounded-xl cursor-pointer transition-colors ${
                    showPointsManual 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>{showPointsManual ? 'Ocultar Reglamento' : 'Ver Reglamento'}</span>
                </button>

                <button
                  onClick={fetchRankings}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-amber-400 rounded-xl cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Actualizar Tabla</span>
                </button>
              </div>
            </div>

            {/* Ranking table */}
            <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden shadow-xl max-w-4xl mx-auto">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-widest font-bold border-b border-slate-850">
                      <th className="p-4 text-center w-24">Posición</th>
                      <th className="p-4">Participante</th>
                      <th className="p-4 text-center w-48 text-amber-400 font-extrabold bg-amber-500/5">Puntos Acumulados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/30">
                    {ranking.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-500">Ningún usuario puntuado aún. Registre resultados oficiales en el panel administrativo.</td>
                      </tr>
                    ) : (
                      ranking.map((u, index) => (
                        <tr key={u.id} className={`hover:bg-slate-900/10 transition-colors ${u.id === currentUser?.id ? 'bg-amber-500/5 border-l-2 border-l-amber-500' : ''}`}>
                          <td className="p-4 text-center font-bold font-mono">
                            {index === 0 ? '🥇 1' : (index === 1 ? '🥈 2' : (index === 2 ? '🥉 3' : index + 1))}
                          </td>
                          <td className="p-4 font-bold text-slate-250 text-sm">
                            {u.nombre}
                            {u.id === currentUser?.id && <span className="ml-1.5 text-[9px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded">TÚ</span>}
                          </td>
                          <td className="p-4 text-center font-black text-base text-amber-400 font-mono bg-amber-500/5">{u.puntos} pts</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SINGLE MASTER ACCORDION FOR OFFICIAL SCORING SYSTEM (FROM IMAGE) */}
            <div className="bg-slate-900/20 rounded-2xl border border-slate-900 overflow-hidden transition-all duration-300">
              <button
                type="button"
                onClick={() => setShowPointsManual(!showPointsManual)}
                className="w-full p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left cursor-pointer hover:bg-slate-900/10 transition-colors"
                id="scoring-system-accordion-toggle"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`p-2.5 rounded-xl border shrink-0 transition-colors ${
                    showPointsManual ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-950/80 border-slate-850 text-slate-400'
                  }`}>
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm uppercase text-white tracking-wider flex items-center gap-2">
                      <span>Sistema de Puntaje Oficial</span>
                      <span className="text-[9px] font-black tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/10 px-2 py-0.5 rounded uppercase">
                        MUNDIAL 2026
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {showPointsManual ? 'Haz clic para contraer el reglamento' : 'Presiona aquí para ver todas las formas de conseguir puntos'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-900">
                  <span className="text-[10px] text-slate-500 font-bold bg-slate-950/80 border border-slate-900 px-3 py-1 rounded-full uppercase tracking-wider">
                    Acumulativo por Partido
                  </span>
                  <div className={`p-1.5 rounded-lg border transition-colors ${
                    showPointsManual ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-slate-950/40 border-slate-900 text-slate-500'
                  }`}>
                    {showPointsManual ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </button>

              <div className={`transition-all duration-300 overflow-hidden ${
                showPointsManual ? 'max-h-[2200px] opacity-100 border-t border-slate-900' : 'max-h-0 opacity-0 pointer-events-none'
              }`}>
                <div className="p-4 sm:p-6 bg-[#030a16]/65 space-y-6">
                  
                  {/* Elegant table with 3 professional columns, detailing removed */}
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 shadow-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-gradient-to-b from-[#091b35] to-[#040f21] text-slate-200 uppercase text-[10px] tracking-widest font-black border-b border-light-white/10 border-white/10">
                          <th className="p-4 pl-5">Tipo de Predicción</th>
                          <th className="p-4 text-center w-36">Puntos</th>
                          <th className="p-4 pr-5 w-48">Cuando se Otorga</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        
                        {/* SECTION: PARTIDOS */}
                        <tr className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
                          <td colSpan={3} className="p-3 pl-5 text-amber-400 font-extrabold tracking-wider uppercase text-[10px] bg-[#020b17] border-y border-white/5">
                            ⚽ PARTIDOS — Se otorgan al finalizar cada partido
                          </td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            Selección del ganador / empate
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500 text-slate-950 text-[10px] font-black px-3 py-1 rounded-md font-mono shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                              3 pts
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al terminar el partido</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            Marcador exacto
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black px-3 py-1 rounded-md font-mono">
                              +2 pts (total 5)
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al terminar el partido</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            Goles de un equipo
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500/15 border border-amber-500/20 text-slate-200 text-[10px] font-black px-3 py-1 rounded-md font-mono">
                              1 pt
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al terminar el partido</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            Diferencia de gol exacta
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500/15 border border-amber-500/20 text-slate-200 text-[10px] font-black px-3 py-1 rounded-md font-mono">
                              1 pt
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al terminar el partido</td>
                        </tr>

                        {/* SECTION: FASE DE GRUPOS */}
                        <tr className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
                          <td colSpan={3} className="p-3 pl-5 text-amber-400 font-extrabold tracking-wider uppercase text-[10px] bg-[#020b17] border-y border-white/5">
                            👥 FASE DE GRUPOS — Se otorgan al cerrar la fase de grupos
                          </td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            1ro de grupo (x12 grupos)
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black px-3 py-1 rounded-md font-mono">
                              5 pts
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al cerrar fase de grupos</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            2do de grupo (x12 grupos)
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black px-3 py-1 rounded-md font-mono">
                              5 pts
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al cerrar fase de grupos</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            Mejores terceros clasificados (8 de 12)
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black px-3 py-1 rounded-md font-mono">
                              5 pts
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al cerrar fase de grupos</td>
                        </tr>

                        {/* SECTION: PREMIOS FIFA */}
                        <tr className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent">
                          <td colSpan={3} className="p-3 pl-5 text-amber-400 font-extrabold tracking-wider uppercase text-[10px] bg-[#020b17] border-y border-white/5">
                            🏆 PREMIOS FIFA — Se otorgan al final del torneo
                          </td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            Campeón del mundo
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500 text-slate-950 text-[10px] font-black px-3 py-1 rounded-md font-mono shadow-[0_0_8px_rgba(245,158,11,0.3)]">
                              12 pts
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al final del torneo</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            Balón de Oro (mejor jugador)
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black px-3 py-1 rounded-md font-mono">
                              10 pts
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al final del torneo</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            Guante de Oro (mejor arquero)
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black px-3 py-1 rounded-md font-mono">
                              10 pts
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al final del torneo</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            Bota de Oro (goleador del torneo)
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black px-3 py-1 rounded-md font-mono">
                              7 pts
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al final del torneo</td>
                        </tr>
                        <tr className="hover:bg-white/5 transition-colors">
                          <td className="p-4 pl-5 font-bold text-white flex items-center gap-2">
                            <span className="text-amber-500/50 text-sm">◽</span>
                            Jugador más joven del torneo
                          </td>
                          <td className="p-4 text-center">
                            <span className="inline-block bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black px-3 py-1 rounded-md font-mono">
                              8 pts
                            </span>
                          </td>
                          <td className="p-4 pr-5 text-slate-300 font-medium">Al final del torneo</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Bento details grid layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Bento Card 1: Puntos Máximos Totales */}
                    <div className="bg-[#040f21]/80 border border-white/10 rounded-xl p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px] uppercase tracking-wider mb-2">
                          <Trophy className="h-4 w-4 shrink-0" />
                          <span>Puntos Máximos Posibles</span>
                        </div>
                        <p className="text-2xl font-black text-white font-mono leading-none">
                          955 <span className="text-amber-400 text-xs font-bold font-sans">PTS MAX</span>
                        </p>
                      </div>
                      <div className="mt-3.5 pt-2.5 border-t border-white/5 text-[10.5px] text-slate-400 font-medium">
                        Ver nota — Partidos + Clasificados + Premios FIFA
                      </div>
                    </div>

                    {/* Bento Card 2: Criterio de desempate */}
                    <div className="bg-[#040f21]/80 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px] uppercase tracking-wider mb-1.5">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>Criterio de Desempate</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-200 font-medium">
                        Si dos o mas participantes terminan con el mismo puntaje, gana quien haya enviado sus predicciones primero (fecha y hora de envio del formulario).
                      </p>
                    </div>

                    {/* Bento Card 3: Nota sobre penales */}
                    <div className="bg-[#040f21]/80 border border-white/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px] uppercase tracking-wider mb-1.5">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>Nota sobre Penales</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-200 font-medium">
                        En partidos de fases eliminatorias que se definan por penales, se toma en cuenta el marcador de los 120 minutos (tiempo regular + tiempo extra). Los penales no cuentan para el marcador.
                      </p>
                    </div>

                    {/* Bento Card 4: Referencia desglose de puntos */}
                    <div className="bg-[#040f21]/80 border border-white/10 rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px] uppercase tracking-wider border-b border-white/5 pb-1">
                        <SlidersHorizontal className="h-4 w-4 shrink-0" />
                        <span>Referencia de Puntos Máximos</span>
                      </div>
                      <ul className="text-[10.5px] space-y-1 text-slate-300 font-medium">
                        <li className="flex justify-between">
                          <span>Partidos fase de grupos (72 partidos x max. 7 pts):</span>
                          <span className="font-mono text-white font-bold">hasta 504 pts</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Partidos fases eliminatorias (32 partidos x max. 7 pts):</span>
                          <span className="font-mono text-white font-bold">hasta 224 pts</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Clasificados de grupo (36 predicciones x 5 pts):</span>
                          <span className="font-mono text-white font-bold">hasta 180 pts</span>
                        </li>
                        <li className="flex justify-between">
                          <span>Premios FIFA al final (campeon + 4 premios):</span>
                          <span className="font-mono text-white font-bold">hasta 47 pts</span>
                        </li>
                        <li className="flex justify-between text-amber-400 font-black border-t border-white/5 pt-1 mt-1 text-[11px]">
                          <span>TOTAL MÁXIMO POSIBLE:</span>
                          <span className="font-mono">955 pts</span>
                        </li>
                      </ul>
                    </div>

                  </div>

                  {/* Suspension detail note banner */}
                  <div className="bg-gradient-to-r from-amber-500/10 via-[#040f21] to-[#040f21] border border-amber-500/25 p-4 rounded-xl flex gap-3 text-slate-200">
                    <Sparkles className="h-5 w-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                    <p className="text-[11px] leading-relaxed font-semibold">
                      Los premios FIFA al final pueden cambiar el ranking completo — mantiene el suspenso hasta el ultimo partido.
                    </p>
                  </div>

                  {/* High Quality Brand footer */}
                  <div className="pt-2 text-center select-none border-t border-white/5">
                    <div className="flex items-center justify-center gap-2 text-[9.5px] tracking-[0.22em] text-slate-400/80 font-bold uppercase">
                      <span>En Almar vivimos el Mundial 2026</span>
                      <span className="text-amber-500">|</span>
                      <span>Bienestar Grupo Almar</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB: PREMIOS FIFA ==================== */}
        {activeTab === 'awards' && currentUser && (() => {
          const hasSavedAwards = !!(
            userPredictions?.award_balon_oro?.predictedWinnerId?.trim() ||
            userPredictions?.award_guante_oro?.predictedWinnerId?.trim() ||
            userPredictions?.award_bota_oro?.predictedWinnerId?.trim() ||
            userPredictions?.award_joven_torneo?.predictedWinnerId?.trim()
          );

          return (
            <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
              {/* Header Info Banner */}
              <div className="relative overflow-hidden rounded-3xl border border-amber-500/10 bg-gradient-to-r from-[#030d22] via-[#091b3a] to-[#04112c] p-6 sm:p-8 shadow-2xl">
                <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
                
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4.5">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/5">
                      <Award className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black tracking-wider uppercase">
                        <Sparkles className="h-3 w-3" />
                        <span>Premios Especiales</span>
                      </div>
                      <h2 className="text-2xl font-black text-white tracking-tight leading-none uppercase pt-1">Premios FIFA 2026</h2>
                      <p className="text-xs text-slate-400 font-medium font-sans">
                        Pronostica los ganadores de los galardones oficiales individuales de la Copa del Mundo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Alert Banner */}
              {hasSavedAwards ? (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3 shadow-md border-solid border">
                  <Lock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-amber-400 uppercase tracking-wide">
                      🔒 Pronósticos de Premios Registrados
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Has ingresado y guardado tus candidatos para los Premios FIFA. Como medida de seguridad y transparencia, <strong className="text-amber-400 font-bold">estos campos se han bloqueado definitivamente</strong> y no es posible editarlos ni realizar modificaciones adicionales.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-5 flex items-start gap-3 shadow-md border-solid border">
                  <Sparkles className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-sky-400 uppercase tracking-wide">
                      ⚡ Registro Abierto de Candidatos de Premios FIFA
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Ingresa tus candidatos en cada categoría y presiona el botón para guardarlos. <strong className="text-amber-400 font-bold">¡PRECAUCIÓN!</strong> Una vez guardados, no se te permitirá realizar ningún cambio. Asegúrate de verificar muy bien la ortografía y nombres antes de enviar.
                    </p>
                  </div>
                </div>
              )}

              {/* Form Body layout */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* BALÓN DE ORO */}
                  <div className={`relative transition-all duration-305 rounded-2xl p-5 border ${
                    hasSavedAwards ? 'bg-slate-950/20 border-slate-900/60 opacity-80' : 'bg-[#020713]/60 border-slate-850 hover:border-amber-500/20'
                  }`}>
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="h-4 w-4 text-amber-500" /> Balón de Oro
                        </span>
                        <span className="text-[10px] font-black font-mono bg-amber-500/10 px-2 py-0.5 rounded-md text-amber-400">10 pts</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-normal">
                        Otorgado al mejor jugador absoluto del mundial.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        disabled={hasSavedAwards}
                        value={predBalonOro}
                        onChange={(e) => setPredBalonOro(e.target.value)}
                        placeholder="Escribe el nombre del jugador..."
                        className="bg-[#020713] border border-slate-800 disabled:opacity-60 disabled:cursor-not-allowed px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 w-full"
                      />
                      
                      {/* Interactive block showing locked state banner */}
                      {hasSavedAwards && (
                        <div className="space-y-2">
                          <div className="text-[10px] uppercase font-black tracking-wider text-amber-500/80 flex items-center gap-1">
                            <Lock className="h-3 w-3 text-amber-500" /> Candidato Bloqueado
                          </div>
                          {(() => {
                            const official = systemConfig.official_balon_oro?.trim();
                            const userVal = predBalonOro?.trim();
                            if (official) {
                              if (userVal && normalizeAwardName(userVal) === normalizeAwardName(official)) {
                                return (
                                  <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/25 text-center uppercase tracking-wide">
                                    ✔️ ¡Acertado! (+10 pts)
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/25 text-center uppercase tracking-wide">
                                      ❌ No Acertado
                                    </div>
                                    <span className="text-[8.5px] font-bold text-slate-500 block text-center truncate">Ganador: {official}</span>
                                  </div>
                                );
                              }
                            } else {
                              return (
                                <div className="text-[9px] font-black text-slate-400 bg-slate-900/60 px-2 py-1 rounded-lg text-center uppercase tracking-wide">
                                  ⏳ Por definir oficial
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GUANTE DE ORO */}
                  <div className={`relative transition-all duration-305 rounded-2xl p-5 border ${
                    hasSavedAwards ? 'bg-slate-950/20 border-slate-900/60 opacity-80' : 'bg-[#020713]/60 border-slate-850 hover:border-amber-500/20'
                  }`}>
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                          <Trophy className="h-4 w-4 text-amber-500" /> Guante de Oro
                        </span>
                        <span className="text-[10px] font-black font-mono bg-amber-500/10 px-2 py-0.5 rounded-md text-amber-400">10 pts</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-normal">
                        Otorgado al mejor arquero o guardameta oficial.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        disabled={hasSavedAwards}
                        value={predGuanteOro}
                        onChange={(e) => setPredGuanteOro(e.target.value)}
                        placeholder="Escribe el nombre del arquero..."
                        className="bg-[#020713] border border-slate-800 disabled:opacity-60 disabled:cursor-not-allowed px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 w-full"
                      />
                      {hasSavedAwards && (
                        <div className="space-y-2">
                          <div className="text-[10px] uppercase font-black tracking-wider text-amber-500/80 flex items-center gap-1">
                            <Lock className="h-3 w-3 text-amber-500" /> Candidato Bloqueado
                          </div>
                          {(() => {
                            const official = systemConfig.official_guante_oro?.trim();
                            const userVal = predGuanteOro?.trim();
                            if (official) {
                              if (userVal && normalizeAwardName(userVal) === normalizeAwardName(official)) {
                                return (
                                  <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/25 text-center uppercase tracking-wide">
                                    ✔️ ¡Acertado! (+10 pts)
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/25 text-center uppercase tracking-wide">
                                      ❌ No Acertado
                                    </div>
                                    <span className="text-[8.5px] font-bold text-slate-500 block text-center truncate">Ganador: {official}</span>
                                  </div>
                                );
                              }
                            } else {
                              return (
                                <div className="text-[9px] font-black text-slate-400 bg-slate-900/60 px-2 py-1 rounded-lg text-center uppercase tracking-wide">
                                  ⏳ Por definir oficial
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* BOTA DE ORO */}
                  <div className={`relative transition-all duration-305 rounded-2xl p-5 border ${
                    hasSavedAwards ? 'bg-slate-950/20 border-slate-900/60 opacity-80' : 'bg-[#020713]/60 border-slate-850 hover:border-amber-500/20'
                  }`}>
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                          <Target className="h-4 w-4 text-amber-500" /> Bota de Oro
                        </span>
                        <span className="text-[10px] font-black font-mono bg-amber-500/10 px-2 py-0.5 rounded-md text-amber-400">7 pts</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-normal">
                        Otorgado al máximo goleador de toda la copa.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        disabled={hasSavedAwards}
                        value={predBotaOro}
                        onChange={(e) => setPredBotaOro(e.target.value)}
                        placeholder="Escribe el nombre del goleador..."
                        className="bg-[#020713] border border-slate-800 disabled:opacity-60 disabled:cursor-not-allowed px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 w-full"
                      />
                      {hasSavedAwards && (
                        <div className="space-y-2">
                          <div className="text-[10px] uppercase font-black tracking-wider text-amber-500/80 flex items-center gap-1">
                            <Lock className="h-3 w-3 text-amber-500" /> Candidato Bloqueado
                          </div>
                          {(() => {
                            const official = systemConfig.official_bota_oro?.trim();
                            const userVal = predBotaOro?.trim();
                            if (official) {
                              if (userVal && normalizeAwardName(userVal) === normalizeAwardName(official)) {
                                return (
                                  <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/25 text-center uppercase tracking-wide">
                                    ✔️ ¡Acertado! (+7 pts)
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/25 text-center uppercase tracking-wide">
                                      ❌ No Acertado
                                    </div>
                                    <span className="text-[8.5px] font-bold text-slate-500 block text-center truncate">Ganador: {official}</span>
                                  </div>
                                );
                              }
                            } else {
                              return (
                                <div className="text-[9px] font-black text-slate-400 bg-slate-900/60 px-2 py-1 rounded-lg text-center uppercase tracking-wide">
                                  ⏳ Por definir oficial
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* JUGADOR JOVEN */}
                  <div className={`relative transition-all duration-305 rounded-2xl p-5 border ${
                    hasSavedAwards ? 'bg-slate-950/20 border-slate-900/60 opacity-80' : 'bg-[#020713]/60 border-slate-850 hover:border-amber-500/20'
                  }`}>
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                          <Activity className="h-4 w-4 text-amber-500" /> Jugador Joven
                        </span>
                        <span className="text-[10px] font-black font-mono bg-amber-500/10 px-2 py-0.5 rounded-md text-amber-400">8 pts</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-normal">
                        Otorgado al mejor jugador sub-21 de la copa.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <input
                        type="text"
                        disabled={hasSavedAwards}
                        value={predJovenTorneo}
                        onChange={(e) => setPredJovenTorneo(e.target.value)}
                        placeholder="Escribe el nombre del jugador..."
                        className="bg-[#020713] border border-slate-800 disabled:opacity-60 disabled:cursor-not-allowed px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 w-full"
                      />
                      {hasSavedAwards && (
                        <div className="space-y-2">
                          <div className="text-[10px] uppercase font-black tracking-wider text-amber-500/80 flex items-center gap-1">
                            <Lock className="h-3 w-3 text-amber-500" /> Candidato Bloqueado
                          </div>
                          {(() => {
                            const official = systemConfig.official_joven_torneo?.trim();
                            const userVal = predJovenTorneo?.trim();
                            if (official) {
                              if (userVal && normalizeAwardName(userVal) === normalizeAwardName(official)) {
                                return (
                                  <div className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/25 text-center uppercase tracking-wide">
                                    ✔️ ¡Acertado! (+8 pts)
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/25 text-center uppercase tracking-wide">
                                      ❌ No Acertado
                                    </div>
                                    <span className="text-[8.5px] font-bold text-slate-500 block text-center truncate">Ganador: {official}</span>
                                  </div>
                                );
                              }
                            } else {
                              return (
                                <div className="text-[9px] font-black text-slate-400 bg-slate-900/60 px-2 py-1 rounded-lg text-center uppercase tracking-wide">
                                  ⏳ Por definir oficial
                                </div>
                              );
                            }
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submitting actions */}
                {!hasSavedAwards && (
                  <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[11px] text-slate-400 font-medium font-sans">
                      ⚠️ Asegúrate de rellenar las categorías correctamente antes de continuar. No se podrán editar después.
                    </p>
                    
                    <button
                      type="button"
                      onClick={handleSaveAwardPredictions}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all hover:scale-[1.02] cursor-pointer inline-flex items-center gap-2 w-full sm:w-auto justify-center font-sans font-extrabold"
                    >
                      <Save className="h-4 w-4 text-slate-950" />
                      <span>Registrar Candidatos Definitivamente</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ==================== TAB: MI PERFIL ==================== */}
        {activeTab === 'profile' && currentUser && (
          <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
            
            {/* Upper Profile Details Section (Read Only) */}
            <div className="relative overflow-hidden rounded-3xl border border-amber-500/10 bg-gradient-to-r from-[#030d22] via-[#091b3a] to-[#04112c] p-6 sm:p-8 shadow-2xl">
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-4.5">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/5">
                    <User className="h-8 w-8" id="profile-avatar-icon" />
                  </div>
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black tracking-wider uppercase">
                      <Trophy className="h-3 w-3" />
                      <span>{currentUser.role === 'admin' ? 'Administrador' : 'Participante'}</span>
                    </div>
                    <h2 className="text-2xl font-black text-white tracking-tight leading-none uppercase pt-1">{currentUser.nombreCompleto}</h2>
                    <p className="text-xs text-slate-400 font-medium font-mono">{currentUser.correo || 'Sin correo registrado'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                  <div className="bg-slate-950/40 border border-slate-900/60 p-3.5 rounded-2xl min-w-[140px] shadow-sm">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Cédula</div>
                    <div className="text-sm font-black text-slate-200 pt-0.5 font-mono">{currentUser.cedula}</div>
                  </div>
                  <div className="bg-slate-950/40 border border-slate-900/60 p-3.5 rounded-2xl min-w-[140px] shadow-sm">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Empresa / Localidad</div>
                    <div className="text-xs font-black text-amber-500/90 pt-0.5">{currentUser.empresa}</div>
                    <div className="text-[10px] text-slate-400">{currentUser.localidad}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* General score counters & statistics */}
            {(() => {
              const uStats = ranking.find((u) => u.id === currentUser.id) || {
                puntos: 0,
                aciertosExactos: 0,
                aciertosGanador: 0,
                aciertosGolesEquipo: 0,
                aciertosDiferenciaGol: 0,
                aciertosPrimeros: 0,
                aciertosSegundos: 0,
                aciertosTerceros: 0,
                puntosCampeon: 0,
                puntosBalonOro: 0,
                puntosGuanteOro: 0,
                puntosBotaOro: 0,
                puntosJovenTorneo: 0
              };

              // Re-calculate live points from local context matches as backup/double safety
              const getMatchPointsBreakdown = (m: any) => {
                if (m.homeScore === undefined || m.homeScore === null || isNaN(Number(m.homeScore))) {
                  return { total: 0, winnerCorrect: false, exactCorrect: false, homeGoalsCorrect: false, awayGoalsCorrect: false, goalDiffCorrect: false, played: false };
                }
                const pHome = parseInt(m.predictedHome, 10);
                const pAway = parseInt(m.predictedAway, 10);
                const oHome = Number(m.homeScore);
                const oAway = Number(m.awayScore);

                if (isNaN(pHome) || isNaN(pAway)) {
                  return { total: 0, winnerCorrect: false, exactCorrect: false, homeGoalsCorrect: false, awayGoalsCorrect: false, goalDiffCorrect: false, played: true };
                }

                const exactCorrect = pHome === oHome && pAway === oAway;
                const predWinner = pHome > pAway ? 'home' : (pHome < pAway ? 'away' : 'draw');
                const officialWinner = oHome > oAway ? 'home' : (oHome < oAway ? 'away' : 'draw');
                let winnerCorrect = predWinner === officialWinner;

                if (m.id.startsWith('K') && oHome === oAway) {
                  if (m.predictedWinnerId && m.winnerId) {
                    winnerCorrect = m.predictedWinnerId === m.winnerId;
                  }
                }

                const homeGoalsCorrect = pHome === oHome;
                const awayGoalsCorrect = pAway === oAway;
                const goalDiffCorrect = (pHome - pAway) === (oHome - oAway);

                let total = 0;
                if (winnerCorrect) total += 3;
                if (exactCorrect) total += 2;
                if (homeGoalsCorrect) total += 1;
                if (awayGoalsCorrect) total += 1;
                if (goalDiffCorrect) total += 1;

                return {
                  total,
                  winnerCorrect,
                  exactCorrect,
                  homeGoalsCorrect,
                  awayGoalsCorrect,
                  goalDiffCorrect,
                  played: true
                };
              };

              return (
                <div className="space-y-6">
                  {/* Big Total points display card */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 bg-gradient-to-b from-[#0b1c3c] to-[#040f25] border border-amber-500/20 rounded-3xl p-6 text-center flex flex-col justify-center items-center shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-20 h-20 bg-amber-500/5 rounded-full blur-xl -ml-6 -mt-6" />
                      <Trophy className="h-10 w-10 text-amber-400 mb-2" />
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Puntos Totales Acumulados</span>
                      <span className="text-5xl font-black text-amber-400 font-mono mt-1 tracking-tight block">{uStats.puntos}</span>
                      <span className="text-xs text-slate-500 mt-1">Calculado en base a resultados oficiales</span>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Acierto Ganador</span>
                        <div className="mt-2.5">
                          <span className="text-2xl font-black font-mono text-slate-200 block">{uStats.aciertosGanador}</span>
                          <span className="text-[10px] text-emerald-400 font-bold block">+{uStats.aciertosGanador * 3} Pts (+3 c/u)</span>
                        </div>
                      </div>

                      <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Marcador Exacto</span>
                        <div className="mt-2.5">
                          <span className="text-2xl font-black font-mono text-slate-200 block">{uStats.aciertosExactos}</span>
                          <span className="text-[10px] text-emerald-400 font-bold block">+{uStats.aciertosExactos * 2} Pts (+2 c/u)</span>
                        </div>
                      </div>

                      <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Goles Equipo</span>
                        <div className="mt-2.5">
                          <span className="text-2xl font-black font-mono text-slate-200 block">{uStats.aciertosGolesEquipo}</span>
                          <span className="text-[10px] text-emerald-400 font-bold block">+{uStats.aciertosGolesEquipo * 1} Pts (+1 c/u)</span>
                        </div>
                      </div>

                      <div className="bg-slate-900/20 border border-slate-900 rounded-2xl p-4 flex flex-col justify-between">
                        <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Dif. Goles</span>
                        <div className="mt-2.5">
                          <span className="text-2xl font-black font-mono text-slate-200 block">{uStats.aciertosDiferenciaGol}</span>
                          <span className="text-[10px] text-emerald-400 font-bold block">+{uStats.aciertosDiferenciaGol * 1} Pts (+1)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="bg-[#030c1e]/60 border border-slate-900 p-4 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Clasificados 1ero</span>
                        <span className="text-lg font-black text-slate-200 block font-mono">{uStats.aciertosPrimeros} aciertos</span>
                      </div>
                      <span className="text-[11px] font-black font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg">+{uStats.aciertosPrimeros * 5} pts</span>
                    </div>

                    <div className="bg-[#030c1e]/60 border border-slate-900 p-4 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Clasificados 2do</span>
                        <span className="text-lg font-black text-slate-200 block font-mono">{uStats.aciertosSegundos} aciertos</span>
                      </div>
                      <span className="text-[11px] font-black font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg text-right">+{uStats.aciertosSegundos * 5} pts</span>
                    </div>

                    <div className="bg-[#030c1e]/60 border border-slate-900 p-4 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Clasificados 3ero</span>
                        <span className="text-lg font-black text-slate-200 block font-mono">{uStats.aciertosTerceros} aciertos</span>
                      </div>
                      <span className="text-[11px] font-black font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg">+{uStats.aciertosTerceros * 5} pts</span>
                    </div>

                    <div className="bg-[#030c1e]/60 border border-slate-900 p-4 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Campeón Mundial</span>
                        <span className="text-xs font-black text-slate-200 block">{uStats.puntosCampeon > 0 ? '✔️ Acertado' : 'Mundial en Curso'}</span>
                      </div>
                      <span className="text-[11px] font-black font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg">+{uStats.puntosCampeon} pts</span>
                    </div>
                  </div>

                  {/* FIFA Awards cumulative points breakdown cards */}
                  <div className="bg-gradient-to-r from-[#030c1e]/80 to-[#0b1c3c]/20 border border-slate-900 p-4 rounded-3xl grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-[#020713]/40 border border-white/5 p-3 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider">Puntos Balón de Oro</span>
                      <span className="text-xl font-black text-amber-400 font-mono">+{uStats.puntosBalonOro || 0} pts</span>
                    </div>
                    <div className="bg-[#020713]/40 border border-white/5 p-3 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider">Puntos Guante de Oro</span>
                      <span className="text-xl font-black text-amber-400 font-mono">+{uStats.puntosGuanteOro || 0} pts</span>
                    </div>
                    <div className="bg-[#020713]/40 border border-white/5 p-3 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider">Puntos Bota de Oro</span>
                      <span className="text-xl font-black text-amber-400 font-mono">+{uStats.puntosBotaOro || 0} pts</span>
                    </div>
                    <div className="bg-[#020713]/40 border border-white/5 p-3 rounded-2xl">
                      <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider">Puntos Jugador Joven</span>
                      <span className="text-xl font-black text-amber-400 font-mono">+{uStats.puntosJovenTorneo || 0} pts</span>
                    </div>
                  </div>

                  {/* SECTION: FIFA AWARDS INDIVIDUAL PREDICTIONS */}
                  <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                      <Award className="h-5 w-5 text-amber-500" />
                      <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                          🏅 Mis Candidatos para Premios FIFA
                        </h3>
                        <p className="text-[10px] text-slate-400">Tus candidatos para los reconocimientos individuales del Mundial 2026 (solo lectura desde aquí).</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      {/* BALON DE ORO */}
                      <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Balón de Oro
                            </span>
                            <span className="text-[9px] font-black font-mono text-slate-500">10 pts</span>
                          </div>
                          <p className="text-[9.5px] text-slate-400 font-semibold">Mejor jugador de la copa</p>
                        </div>
                        
                        <input
                          type="text"
                          value={predBalonOro}
                          disabled={true}
                          placeholder="No ingresado"
                          className="bg-[#020713]/40 border border-slate-900 px-3 py-1.5 rounded-lg text-xs text-slate-400 focus:outline-none w-full font-bold cursor-not-allowed"
                        />

                        {/* RESULT STATUS */}
                        <div className="pt-1">
                          {(() => {
                            const official = systemConfig.official_balon_oro?.trim();
                            const userVal = predBalonOro?.trim();
                            if (!official) {
                              return (
                                <span className="text-[9px] font-black text-slate-400 bg-slate-900/80 px-2 py-1 rounded-md block text-center uppercase tracking-wide">
                                  ⏳ Por definir
                                </span>
                              );
                            }
                            if (userVal && normalizeAwardName(userVal) === normalizeAwardName(official)) {
                              return (
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md block text-center uppercase tracking-wide border border-emerald-500/25">
                                  ✔️ ¡Acertado! (+10)
                                </span>
                              );
                            }
                            return (
                              <div className="space-y-1">
                                <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md block text-center uppercase tracking-wide border border-rose-500/25">
                                  ❌ Fallado
                                </span>
                                <span className="text-[8.5px] font-black text-slate-500 block text-center truncate">Oficial: {official}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* GUANTE DE ORO */}
                      <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                              <Trophy className="h-3.5 w-3.5 text-amber-500" /> Guante de Oro
                            </span>
                            <span className="text-[9px] font-black font-mono text-slate-500">10 pts</span>
                          </div>
                          <p className="text-[9.5px] text-slate-400 font-semibold">Mejor arquero de la copa</p>
                        </div>
                        
                        <input
                          type="text"
                          value={predGuanteOro}
                          disabled={true}
                          placeholder="No ingresado"
                          className="bg-[#020713]/40 border border-slate-900 px-3 py-1.5 rounded-lg text-xs text-slate-400 focus:outline-none w-full font-bold cursor-not-allowed"
                        />

                        {/* RESULT STATUS */}
                        <div className="pt-1">
                          {(() => {
                            const official = systemConfig.official_guante_oro?.trim();
                            const userVal = predGuanteOro?.trim();
                            if (!official) {
                              return (
                                <span className="text-[9px] font-black text-slate-400 bg-slate-900/80 px-2 py-1 rounded-md block text-center uppercase tracking-wide">
                                  ⏳ Por definir
                                </span>
                              );
                            }
                            if (userVal && normalizeAwardName(userVal) === normalizeAwardName(official)) {
                              return (
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md block text-center uppercase tracking-wide border border-emerald-500/25">
                                  ✔️ ¡Acertado! (+10)
                                </span>
                              );
                            }
                            return (
                              <div className="space-y-1">
                                <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md block text-center uppercase tracking-wide border border-rose-500/25">
                                  ❌ Fallado
                                </span>
                                <span className="text-[8.5px] font-black text-slate-500 block text-center truncate">Oficial: {official}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* BOTA DE ORO */}
                      <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                              <Target className="h-3.5 w-3.5 text-amber-500" /> Bota de Oro
                            </span>
                            <span className="text-[9px] font-black font-mono text-slate-500">7 pts</span>
                          </div>
                          <p className="text-[9.5px] text-slate-400 font-semibold">Goleador del torneo</p>
                        </div>
                        
                        <input
                          type="text"
                          value={predBotaOro}
                          disabled={true}
                          placeholder="No ingresado"
                          className="bg-[#020713]/40 border border-slate-900 px-3 py-1.5 rounded-lg text-xs text-slate-400 focus:outline-none w-full font-bold cursor-not-allowed"
                        />

                        {/* RESULT STATUS */}
                        <div className="pt-1">
                          {(() => {
                            const official = systemConfig.official_bota_oro?.trim();
                            const userVal = predBotaOro?.trim();
                            if (!official) {
                              return (
                                <span className="text-[9px] font-black text-slate-400 bg-slate-900/80 px-2 py-1 rounded-md block text-center uppercase tracking-wide">
                                  ⏳ Por definir
                                </span>
                              );
                            }
                            if (userVal && normalizeAwardName(userVal) === normalizeAwardName(official)) {
                              return (
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md block text-center uppercase tracking-wide border border-emerald-500/25">
                                  ✔️ ¡Acertado! (+7)
                                </span>
                              );
                            }
                            return (
                              <div className="space-y-1">
                                <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md block text-center uppercase tracking-wide border border-rose-500/25">
                                  ❌ Fallado
                                </span>
                                <span className="text-[8.5px] font-black text-slate-500 block text-center truncate">Oficial: {official}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* JUGADOR JOVEN */}
                      <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                              <Activity className="h-3.5 w-3.5 text-amber-500" /> Jugador Joven
                            </span>
                            <span className="text-[9px] font-black font-mono text-slate-500">8 pts</span>
                          </div>
                          <p className="text-[9.5px] text-slate-400 font-semibold">Jugador más joven de la copa</p>
                        </div>
                        
                        <input
                          type="text"
                          value={predJovenTorneo}
                          disabled={true}
                          placeholder="No ingresado"
                          className="bg-[#020713]/40 border border-slate-900 px-3 py-1.5 rounded-lg text-xs text-slate-400 focus:outline-none w-full font-bold cursor-not-allowed"
                        />

                        {/* RESULT STATUS */}
                        <div className="pt-1">
                          {(() => {
                            const official = systemConfig.official_joven_torneo?.trim();
                            const userVal = predJovenTorneo?.trim();
                            if (!official) {
                              return (
                                <span className="text-[9px] font-black text-slate-400 bg-slate-900/80 px-2 py-1 rounded-md block text-center uppercase tracking-wide">
                                  ⏳ Por definir
                                </span>
                              );
                            }
                            if (userVal && normalizeAwardName(userVal) === normalizeAwardName(official)) {
                              return (
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md block text-center uppercase tracking-wide border border-emerald-500/25">
                                  ✔️ ¡Acertado! (+8)
                                </span>
                              );
                            }
                            return (
                              <div className="space-y-1">
                                <span className="text-[9px] font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md block text-center uppercase tracking-wide border border-rose-500/25">
                                  ❌ Fallado
                                </span>
                                <span className="text-[8.5px] font-black text-slate-500 block text-center truncate">Oficial: {official}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5 font-sans">
                        🔒 Bloqueado en Perfil • Adminístralo en la opción «Premios FIFA» del menú principal
                      </span>
                    </div>
                  </div>

                  {/* detailed user predictions list where we compute score per prediction live */}
                  <div className="space-y-4">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-white/5 pb-4">
                      <div>
                        <h3 className="text-lg font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                          <ClipboardList className="h-5 w-5 text-amber-500" />
                          Desglose de Puntos por Pronóstico
                        </h3>
                        <p className="text-xs text-slate-400">Verifica los puntos que vas acumulando con cada partido y pronóstico.</p>
                      </div>

                      <div className="flex flex-row flex-wrap items-center gap-3 w-full lg:w-auto">
                        {/* Week filter */}
                        <select
                          value={profileSearchWeek}
                          onChange={(e) => setProfileSearchWeek(e.target.value)}
                          className="bg-slate-950 text-slate-300 rounded-xl px-3 py-1.5 text-xs border border-slate-900 focus:outline-none focus:border-amber-500/50"
                        >
                          <option value="all">Todas las semanas</option>
                          <option value="1">Semana 1</option>
                          <option value="2">Semana 2</option>
                          <option value="3">Semana 3</option>
                          <option value="4">Semana 4</option>
                          <option value="5">Semana 5</option>
                          <option value="6">Semana 6</option>
                        </select>

                        {/* Search field */}
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                          <input
                            type="text"
                            placeholder="Buscar por equipo o etapa..."
                            value={profileSearchTerm}
                            onChange={(e) => setProfileSearchTerm(e.target.value)}
                            className="bg-slate-950 border border-slate-900 pl-9 pr-4 py-1.5 rounded-xl text-xs text-slate-300 w-full sm:w-56 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>

                        {/* Played matches only switcher toggle */}
                        <button
                          type="button"
                          onClick={() => setProfileOnlyWithPoints(!profileOnlyWithPoints)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                            profileOnlyWithPoints
                              ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                              : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Activity className="h-3.5 w-3.5" />
                          <span>{profileOnlyWithPoints ? 'Solo Partidos Jugados' : 'Todos los Pronósticos'}</span>
                        </button>
                      </div>
                    </div>

                    {/* render the cards of predictions */}
                    {(() => {
                      // Filter predictions based on search term & only played toggle
                      const filteredMatches = combinedMatches.filter((m) => {
                        const homeRes = resolveTeamWithManualOverrides(m.homeTeamId);
                        const awayRes = resolveTeamWithManualOverrides(m.awayTeamId);
                        const homeName = 'name' in homeRes ? homeRes.name : homeRes.text;
                        const awayName = 'name' in awayRes ? awayRes.name : awayRes.text;

                        if (profileSearchWeek !== 'all') {
                          if (getMatchWeek(m.date).toString() !== profileSearchWeek) {
                            return false;
                          }
                        }

                        const matchesSearch = 
                          homeName.toLowerCase().includes(profileSearchTerm.toLowerCase()) ||
                          awayName.toLowerCase().includes(profileSearchTerm.toLowerCase()) ||
                          m.stage.toLowerCase().includes(profileSearchTerm.toLowerCase());

                        if (!matchesSearch) return false;

                        if (profileOnlyWithPoints) {
                          // Check if match is played
                          const isPlayed = m.homeScore !== undefined && m.homeScore !== null && !isNaN(Number(m.homeScore));
                          if (!isPlayed) return false;
                        }

                        return true;
                      });

                      if (filteredMatches.length === 0) {
                        return (
                          <div className="bg-slate-950/20 border border-slate-900 rounded-2xl p-12 text-center text-slate-500 text-xs">
                            No se encontraron partidos que coincidan con la búsqueda o filtros aplicados.
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filteredMatches.map((m) => {
                            const homeRes = resolveTeamWithManualOverrides(m.homeTeamId);
                            const awayRes = resolveTeamWithManualOverrides(m.awayTeamId);

                            const pointsHelp = getMatchPointsBreakdown(m);
                            const isMatchPlayed = pointsHelp.played;

                            return (
                              <div key={m.id} className={`p-4 rounded-2xl border transition-all duration-200 ${
                                isMatchPlayed 
                                  ? 'bg-slate-900/20 border-slate-850 hover:border-amber-500/20' 
                                  : 'bg-slate-950/40 border-slate-900 hover:border-slate-800'
                              }`}>
                                {/* Card top metadata */}
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider pb-2 border-b border-white/5 mb-3">
                                  <span>{m._stageName || m.stage}</span>
                                  <span>{m.date} - {m.time}</span>
                                </div>

                                {/* Teams & Scores */}
                                <div className="flex items-center justify-between gap-4">
                                  {/* Home Team */}
                                  <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                    {'flag' in homeRes ? (
                                      <img src={getTeamFlagUrl((homeRes as any).id)} className="w-[18px] h-3 object-cover rounded shadow border border-slate-800 shrink-0" alt="" referrerPolicy="no-referrer" />
                                    ) : (
                                      <span className="shrink-0 text-xs">🏳️</span>
                                    )}
                                    <span className="truncate text-xs font-bold text-slate-300">
                                      {'name' in homeRes ? homeRes.name : homeRes.text}
                                    </span>
                                  </div>

                                  {/* Center Scores */}
                                  <div className="flex flex-col items-center justify-center shrink-0 px-2 min-w-[70px]">
                                    <div className="text-[9px] text-slate-500 font-bold uppercase leading-none pb-1">Tu Prono</div>
                                    <div className="text-xs font-black font-mono text-amber-400 tracking-tight">
                                      {m.predictedHome !== '' ? `${m.predictedHome} - ${m.predictedAway}` : 'Sin Pro.'}
                                    </div>
                                    <div className="text-[9px] text-slate-500 font-bold uppercase leading-none py-1">Oficial</div>
                                    <div className="text-xs font-bold font-mono text-slate-300">
                                      {isMatchPlayed ? `${m.homeScore} - ${m.awayScore}` : 'Pendiente'}
                                    </div>
                                  </div>

                                  {/* Away Team */}
                                  <div className="flex items-center gap-2 truncate flex-1 min-w-0 justify-end text-right">
                                    <span className="truncate text-xs font-bold text-slate-300">
                                      {'name' in awayRes ? awayRes.name : awayRes.text}
                                    </span>
                                    {'flag' in awayRes ? (
                                      <img src={getTeamFlagUrl((awayRes as any).id)} className="w-[18px] h-3 object-cover rounded shadow border border-slate-800 shrink-0" alt="" referrerPolicy="no-referrer" />
                                    ) : (
                                      <span className="shrink-0 text-xs">🏳️</span>
                                    )}
                                  </div>
                                </div>

                                {/* Scoring Breakdown Strip */}
                                <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                                  {/* Points Pill indicator */}
                                  <div>
                                    {isMatchPlayed ? (
                                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-black font-mono">
                                        +{pointsHelp.total} pts
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 text-[10px] font-semibold">
                                        <Clock className="h-3 w-3" /> Pendiente
                                      </span>
                                    )}
                                  </div>

                                  {/* Small checkboxes checklist */}
                                  {isMatchPlayed && (
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] leading-none text-slate-500 font-bold">
                                      <span className={pointsHelp.winnerCorrect ? 'text-emerald-500' : 'text-slate-700'}>
                                        {pointsHelp.winnerCorrect ? '✓' : '✗'} Ganador (+3)
                                      </span>
                                      <span className={pointsHelp.exactCorrect ? 'text-emerald-500' : 'text-slate-700'}>
                                        {pointsHelp.exactCorrect ? '✓' : '✗'} Exacto (+2)
                                      </span>
                                      <span className={pointsHelp.homeGoalsCorrect ? 'text-emerald-500' : 'text-slate-700'}>
                                        {pointsHelp.homeGoalsCorrect ? '✓' : '✗'} Gol L (+1)
                                      </span>
                                      <span className={pointsHelp.awayGoalsCorrect ? 'text-emerald-500' : 'text-slate-700'}>
                                        {pointsHelp.awayGoalsCorrect ? '✓' : '✗'} Gol V (+1)
                                      </span>
                                      <span className={pointsHelp.goalDiffCorrect ? 'text-emerald-500' : 'text-slate-700'}>
                                        {pointsHelp.goalDiffCorrect ? '✓' : '✗'} Dif (+1)
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })()}

            {/* Accent copyright style line */}
            <div className="pt-2 text-center select-none border-t border-white/5">
              <div className="flex items-center justify-center gap-2 text-[9.5px] tracking-[0.22em] text-slate-400/80 font-bold uppercase">
                <span>En Almar vivimos el Mundial 2026</span>
                <span className="text-amber-500">|</span>
                <span>Bienestar Grupo Almar</span>
              </div>
            </div>

          </div>
        )}

        {/* ==================== TAB: ADMIN CONTROL ==================== */}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <div className="space-y-6">
            
            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-xl font-extrabold text-white uppercase tracking-tight flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-rose-500" />
                  Panel de Administración del Mundial 2026
                </h2>
                <p className="text-xs text-slate-400">
                  Registra resultados oficiales, exporta participantes, bloquea usuarios e ingresa marcadores oficiales del torneo.
                </p>
              </div>

              <div className="flex gap-2">
                <a
                  href="/api/admin/export"
                  download
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 font-bold text-white text-xs rounded-xl transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Exportar a Excel (CSV)</span>
                </a>
              </div>
            </div>

            {/* General Admin Statistics Cards */}
            {adminStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-900 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Total Usuarios registrados</span>
                  <div className="text-xl font-black text-white">{adminStats.totalUsers}</div>
                </div>
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-900 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Usuarios Activos</span>
                  <div className="text-xl font-black text-emerald-400">{adminStats.activeUsers}</div>
                </div>
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-900 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Usuarios Bloqueados</span>
                  <div className="text-xl font-black text-rose-400">{adminStats.blockedUsers}</div>
                </div>
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-900 space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Total de Pronósticos guardados</span>
                  <div className="text-xl font-black text-teal-400">{adminStats.totalPredictionsMade}</div>
                </div>
              </div>
            )}

            {/* Control de Desbloqueo de Semanas de Partidos */}
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-900 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-sm uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <Unlock className="h-4 w-4" />
                    Habilitación de Pronósticos Semanales
                  </h3>
                  <p className="text-xs text-slate-400">
                    Controla qué semana de partidos está actualmente habilitada para que los participantes coloquen sus pronósticos. Las semanas superiores se mantendrán bloqueadas.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold uppercase mr-1">Semana Activa:</span>
                  <span className="bg-amber-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg border border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                    Semana {unlockedWeek}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleUpdateUnlockedWeek(1)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    unlockedWeek === 1
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-black uppercase">Semana 1</span>
                  <span className="text-[9px] font-bold opacity-60 font-mono">(11 - 14 Jun)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateUnlockedWeek(2)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    unlockedWeek === 2
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-black uppercase">Semana 2</span>
                  <span className="text-[9px] font-bold opacity-60 font-mono">(15 - 21 Jun)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateUnlockedWeek(3)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    unlockedWeek === 3
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-black uppercase">Semana 3</span>
                  <span className="text-[9px] font-bold opacity-60 font-mono">(22 - 28 Jun)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateUnlockedWeek(4)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    unlockedWeek === 4
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-black uppercase">Semana 4</span>
                  <span className="text-[9px] font-bold opacity-60 font-mono">(29 Jun - 05 Jul)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateUnlockedWeek(5)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    unlockedWeek === 5
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-black uppercase">Semana 5</span>
                  <span className="text-[9px] font-bold opacity-60 font-mono">(06 - 12 Jul)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateUnlockedWeek(6)}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    unlockedWeek === 6
                      ? 'bg-amber-500/10 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span className="text-xs font-black uppercase">Semana 6</span>
                  <span className="text-[9px] font-bold opacity-60 font-mono">(13 - 19 Jul)</span>
                </button>
              </div>
            </div>

            {/* Registro de Ganadores de Premios Oficiales FIFA */}
            <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-900 space-y-4">
              <div className="space-y-1">
                <h3 className="font-bold text-sm uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-amber-400" />
                  Registro de Ganadores Oficiales de Premios FIFA
                </h3>
                <p className="text-xs text-slate-400">
                  Registra los ganadores oficiales del torneo. Los puntos de los participantes se recalcularán automáticamente en tiempo real.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Balón de Oro</label>
                  <input
                    type="text"
                    value={adminBalonOro}
                    onChange={(e) => setAdminBalonOro(e.target.value)}
                    placeholder="Nombre del Jugador..."
                    className="bg-[#020713] border border-slate-850 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 w-full"
                  />
                </div>

                <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Guante de Oro</label>
                  <input
                    type="text"
                    value={adminGuanteOro}
                    onChange={(e) => setAdminGuanteOro(e.target.value)}
                    placeholder="Nombre del Arquero..."
                    className="bg-[#020713] border border-slate-850 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 w-full"
                  />
                </div>

                <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Bota de Oro</label>
                  <input
                    type="text"
                    value={adminBotaOro}
                    onChange={(e) => setAdminBotaOro(e.target.value)}
                    placeholder="Nombre del Goleador..."
                    className="bg-[#020713] border border-slate-850 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 w-full"
                  />
                </div>

                <div className="bg-slate-950/40 border border-slate-900 p-3 rounded-xl space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">Jugador Joven del Torneo</label>
                  <input
                    type="text"
                    value={adminJovenTorneo}
                    onChange={(e) => setAdminJovenTorneo(e.target.value)}
                    placeholder="Nombre del Jugador Joven..."
                    className="bg-[#020713] border border-slate-850 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500/50 w-full"
                  />
                </div>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  onClick={handleSaveAdminAwards}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all hover:scale-[1.02] cursor-pointer inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Registrar Premios Oficiales</span>
                </button>
              </div>
            </div>

            {/* Grid Split: Users Admin vs Score Registration */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Official Score Registration panel (7/12) */}
              <div className="lg:col-span-7 bg-slate-900/40 p-5 rounded-2xl border border-slate-900 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-850 pb-2.5">
                  <h3 className="font-bold text-sm uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Cargar Resultados Oficiales
                  </h3>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedAdminMatchStage}
                      onChange={(e) => setSelectedAdminMatchStage(e.target.value as StageType | 'all')}
                      className="bg-slate-950 text-slate-300 rounded px-2.5 py-1 text-xs border border-slate-850"
                    >
                      <option value="all">Fase torneo completo</option>
                      <option value="group">Fase de Grupos</option>
                      <option value="1/16">1/16 Final</option>
                      <option value="1/8">1/8 Final</option>
                      <option value="1/4">1/4 Final</option>
                      <option value="1/2">Semifinales</option>
                      <option value="final">Final</option>
                    </select>
                    <select
                      value={selectedAdminMatchWeek}
                      onChange={(e) => setSelectedAdminMatchWeek(e.target.value)}
                      className="bg-slate-950 text-slate-300 rounded px-2.5 py-1 text-xs border border-slate-850"
                    >
                      <option value="all">Todas las semanas</option>
                      <option value="1">Semana 1</option>
                      <option value="2">Semana 2</option>
                      <option value="3">Semana 3</option>
                      <option value="4">Semana 4</option>
                      <option value="5">Semana 5</option>
                      <option value="6">Semana 6</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[380px] space-y-3 pr-1">
                  {combinedMatches
                    .filter(m => selectedAdminMatchStage === 'all' || m.stage === selectedAdminMatchStage)
                    .filter(m => selectedAdminMatchWeek === 'all' || getMatchWeek(m.date).toString() === selectedAdminMatchWeek)
                    .map((m) => {
                      const homeRes = resolveTeamWithManualOverrides(m.homeTeamId);
                      const awayRes = resolveTeamWithManualOverrides(m.awayTeamId);

                      const savedScore = officialResults[m.id] || {};
                      
                      const inputHome = adminScores[m.id]?.home !== undefined ? adminScores[m.id].home : (savedScore.homeScore !== undefined ? savedScore.homeScore.toString() : '');
                      const inputAway = adminScores[m.id]?.away !== undefined ? adminScores[m.id].away : (savedScore.awayScore !== undefined ? savedScore.awayScore.toString() : '');
                      const inputWinner = adminScores[m.id]?.winner !== undefined ? adminScores[m.id].winner : savedScore.winnerId;

                      const isTie = inputHome !== '' && inputAway !== '' && parseInt(inputHome, 10) === parseInt(inputAway, 10);

                      return (
                        <div key={m.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-850 flex flex-col gap-2">
                          <div className="flex justify-between text-[9px] text-slate-500 border-b border-slate-900 pb-1.5">
                            <span className="font-bold text-amber-500">M-ID: {m.id} ({m.stage})</span>
                            <span>{m.date} | {m.time}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            {/* Home */}
                            <div className="flex-1 truncate text-right font-semibold text-xs flex items-center justify-end gap-1.5">
                              <span className="truncate">{'name' in homeRes ? homeRes.name : homeRes.text}</span>
                              {'flag' in homeRes ? (
                                <img src={getTeamFlagUrl((homeRes as any).id)} className="w-4 h-3 object-cover rounded shadow-sm border border-slate-800 shrink-0" alt="" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-xs shrink-0">🏳️</span>
                              )}
                            </div>

                            {/* Inputs */}
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="text"
                                placeholder="-"
                                value={inputHome}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val !== '' && !/^\d+$/.test(val)) return;
                                  setAdminScores(prev => ({
                                    ...prev,
                                    [m.id]: { ...(prev[m.id] || { home: '', away: '' }), home: val }
                                  }));
                                }}
                                className="w-8 py-0.5 text-center bg-slate-900 text-xs font-bold text-white border border-slate-805 rounded"
                              />
                              <span className="text-[10px] font-mono text-slate-600">:</span>
                              <input
                                type="text"
                                placeholder="-"
                                value={inputAway}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val !== '' && !/^\d+$/.test(val)) return;
                                  setAdminScores(prev => ({
                                    ...prev,
                                    [m.id]: { ...(prev[m.id] || { home: '', away: '' }), away: val }
                                  }));
                                }}
                                className="w-8 py-0.5 text-center bg-slate-900 text-xs font-bold text-white border border-slate-805 rounded"
                              />
                            </div>

                            {/* Away */}
                            <div className="flex-1 truncate font-semibold text-xs flex items-center gap-1.5">
                              {'flag' in awayRes ? (
                                <img src={getTeamFlagUrl((awayRes as any).id)} className="w-4 h-3 object-cover rounded shadow-sm border border-slate-800 shrink-0" alt="" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-xs shrink-0">🏳️</span>
                              )}
                              <span className="truncate">{'name' in awayRes ? awayRes.name : awayRes.text}</span>
                            </div>
                          </div>

                          {/* Winner dropdown for ties */}
                          {isTie && (
                            <div className="flex items-center justify-end gap-1.5 text-[10px] text-slate-450 mt-1">
                              <span>Ganador penales:</span>
                              <select
                                value={inputWinner || ''}
                                onChange={(e) => {
                                  setAdminScores(prev => ({
                                    ...prev,
                                    [m.id]: { ...(prev[m.id] || { home: '', away: '' }), winner: e.target.value }
                                  }));
                                }}
                                className="bg-slate-900 border border-slate-800 rounded text-[10px] p-0.5 text-amber-400 focus:outline-none"
                              >
                                <option value="">-- Elige --</option>
                                <option value="no_aplica">No aplica</option>
                                <option value={'id' in homeRes ? homeRes.id : ''}>{'name' in homeRes ? homeRes.name : 'Local'}</option>
                                <option value={'id' in awayRes ? awayRes.id : ''}>{'name' in awayRes ? awayRes.name : 'Visitante'}</option>
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>

                <button
                  type="button"
                  onClick={handleSaveOfficialAdminScores}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors mt-2"
                >
                  Confirmar y Guardar Marcadores Oficiales
                </button>
              </div>

              {/* Right Column: User Management list (5/12) */}
              <div className="lg:col-span-5 bg-slate-900/40 p-5 rounded-2xl border border-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                  <h3 className="font-bold text-sm uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    Manejo de Participantes
                  </h3>
                  <button 
                    onClick={fetchAdminData}
                    className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Actualizar lista de usuarios"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>

                {/* Filtros de Empresa, Localidad y Buscador de Nombre/Cédula */}
                <div className="space-y-3 bg-slate-950/50 p-3.5 rounded-xl border border-slate-850">
                  <div>
                    <label className="block text-[9px] font-black text-slate-450 text-slate-400 uppercase tracking-widest mb-1.5">
                      Buscar por Nombre o Cédula
                    </label>
                    <input
                      type="text"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                      placeholder="Ej: Juan Pérez o 12345678"
                      value={adminUserSearch}
                      onChange={(e) => setAdminUserSearch(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-black text-slate-450 text-slate-400 uppercase tracking-widest mb-1.5">
                        Empresa
                      </label>
                      <select
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
                        value={adminCompanyFilter}
                        onChange={(e) => setAdminCompanyFilter(e.target.value)}
                      >
                        <option value="all">Todas ({adminCompanies.length})</option>
                        {adminCompanies.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-450 text-slate-400 uppercase tracking-widest mb-1.5">
                        Localidad
                      </label>
                      <select
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-1.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
                        value={adminLocalityFilter}
                        onChange={(e) => setAdminLocalityFilter(e.target.value)}
                      >
                        <option value="all">Todas ({adminLocalities.length})</option>
                        {adminLocalities.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Resumen de Filtros */}
                <div className="flex items-center justify-between text-[11px] text-slate-450 text-slate-400 px-1">
                  <span>Mostrando: <strong>{filteredAdminUsers.length}</strong> de {adminUsers.length}</span>
                  {(adminCompanyFilter !== 'all' || adminLocalityFilter !== 'all' || adminUserSearch !== '') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdminCompanyFilter('all');
                        setAdminLocalityFilter('all');
                        setAdminUserSearch('');
                      }}
                      className="text-amber-400 hover:underline hover:text-amber-300 font-bold cursor-pointer"
                    >
                      Limpiar Filtros
                    </button>
                  )}
                </div>

                <div className="overflow-y-auto max-h-[440px] space-y-3 pr-1">
                  {filteredAdminUsers.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 italic">
                      No se encontraron participantes con los filtros aplicados.
                    </div>
                  ) : (
                    filteredAdminUsers.map((usr) => (
                      <div 
                        key={usr.id} 
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                          usr.blocked ? 'bg-red-950/10 border-red-900/30 text-slate-400' : 'bg-slate-950 border-slate-850 text-slate-100'
                        }`}
                      >
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="font-extrabold truncate text-white feel-medium flex items-center gap-1">
                            <span>{usr.nombreCompleto}</span>
                            {usr.role === 'admin' && <span className="bg-rose-600 text-white text-[8px] font-bold px-1.5 rounded uppercase">Admin</span>}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">CI: {usr.cedula || 'N/D'}{usr.correo && ` • ${usr.correo}`}</div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {usr.empresa || 'Sin Empresa'} • {usr.localidad || 'Sin Localidad'}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1.5 shrink-0 items-end">
                          <button
                            type="button"
                            onClick={() => handleToggleBlockUser(usr.id, !!usr.blocked)}
                            className={`w-20 text-center text-[10px] font-black py-1 px-1.5 rounded-lg border transition-all cursor-pointer ${
                              usr.blocked 
                                ? 'bg-rose-600/15 border-rose-500/30 text-rose-450 text-rose-400 hover:bg-rose-600 hover:text-white' 
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-rose-600 hover:text-white'
                            }`}
                          >
                            {usr.blocked ? 'Habilitar' : 'Bloquear'}
                          </button>

                          {usr.role !== 'admin' && (
                            deletingUserId === usr.id ? (
                              <div className="flex flex-col gap-1 items-stretch w-20">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(usr.id)}
                                  className="w-full text-center text-[9px] font-black bg-red-650 bg-red-600 hover:bg-red-700 text-white rounded-md py-0.5 transition-colors cursor-pointer"
                                >
                                  Sí, borrar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingUserId(null)}
                                  className="w-full text-center text-[9px] font-bold bg-slate-900 border border-slate-800 text-slate-450 text-slate-400 rounded-md py-0.5 transition-colors cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeletingUserId(usr.id)}
                                className="w-20 text-center text-[10px] font-black py-1 px-1.5 rounded-lg border border-red-950/40 bg-red-950/20 text-red-400 hover:bg-red-600 hover:text-white transition-all cursor-pointer"
                              >
                                Eliminar
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      <footer className="border-t border-slate-900 py-6 mt-12 bg-slate-950 text-center text-slate-500 text-xs">
        <p className="max-w-md mx-auto">
          Polla Mundialista 2026. Todos los derechos reservados. Desarrollado por Jhonny Vargas
        </p>
      </footer>

    </div>
  );
}
