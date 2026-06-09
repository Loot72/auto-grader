import React, { useState, useEffect } from 'react';
import { 
  User, 
  GraduationCap, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  FileText, 
  Check,
  ChevronRight,
  Save,
  Play,
  ArrowLeft,
  Lock,
  Key,
  Download,
  RotateCcw
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';

// Firebase 초기화 (외부)
const firebaseConfig = {
  apiKey: "AIzaSyClSLaDS_yzVSdxsx17lIFzPNwQgF2R-8Y",
  authDomain: "school-grader-loot72.firebaseapp.com",
  projectId: "school-grader-loot72",
  storageBucket: "school-grader-loot72.firebasestorage.app",
  messagingSenderId: "777991098504",
  appId: "1:777991098504:web:90f56140e48e87dea3cf3d"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "school-grader-loot72"

// --- 샘플 데이터 ---
const sampleExam = {
  id: 'exam-1',
  title: "1학기 중간고사 (샘플 시험지)",
  questions: [
    { id: 'q1', type: 'multiple_choice', text: "다음 중 대한민국의 수도는 어디인가요?", options: ["부산", "서울", "대구", "인천"], answer: "1", points: 10 },
    { id: 'q2', type: 'short_answer', text: "H2O는 어떤 물질의 화학식인가요?", answer: "물", points: 10 },
    { id: 'q3', type: 'essay', text: "인공지능 기술이 미래 사회에 미칠 긍정적인 영향에 대해 서술하시오.", answer: "", points: 20 }
  ]
};

export default function App() {
  // 앱 모드: 'select_role', 'teacher', 'student'
  const [appMode, setAppMode] = useState('select_role');
  const [user, setUser] = useState(null);
  
  // 데이터 상태 (Firebase 연동)
  const [exam, setExam] = useState(sampleExam);
  const [submissions, setSubmissions] = useState([]);

  // Firebase 인증 초기화
  useEffect(() => {
const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth init error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 실시간 데이터 동기화
  useEffect(() => {
    if (!user) return;

    // 1. 시험지 실시간 리스너
    const examDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'exams', 'current_exam');
    const unsubExam = onSnapshot(examDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setExam(docSnap.data());
      }
    }, (err) => console.error("Exam sync error:", err));

    // 2. 제출물 실시간 리스너
    const subsRef = collection(db, 'artifacts', appId, 'public', 'data', 'submissions');
    const unsubSubs = onSnapshot(subsRef, (snapshot) => {
      const subs = [];
      snapshot.forEach(d => subs.push({ id: d.id, ...d.data() }));
      subs.sort((a, b) => b.timestamp - a.timestamp); // 최신순 정렬 (자바스크립트 내 정렬)
      setSubmissions(subs);
    }, (err) => console.error("Submissions sync error:", err));

    return () => {
      unsubExam();
      unsubSubs();
    };
  }, [user]);

  // --- 화면 전환 ---
  if (appMode === 'select_role') {
    return <RoleSelector setAppMode={setAppMode} />;
  }

  if (appMode === 'teacher') {
    return <TeacherDashboard 
              exam={exam} 
              setExam={setExam} 
              submissions={submissions}
              setSubmissions={setSubmissions}
              goBack={() => setAppMode('select_role')} 
           />;
  }

  if (appMode === 'student') {
    return <StudentDashboard 
              exam={exam} 
              submitExam={async (submission) => {
                try {
                  const subsRef = collection(db, 'artifacts', appId, 'public', 'data', 'submissions');
                  await addDoc(subsRef, submission);
                } catch(err) {
                  console.error("Submit error:", err);
                }
              }}
              goBack={() => setAppMode('select_role')} 
           />;
  }

  return null;
}

// ==========================================
// 1. 역할 선택 화면
// ==========================================
function RoleSelector({ setAppMode }) {
  const [modalState, setModalState] = useState('none'); // 'none', 'set', 'enter'
  const [password, setPassword] = useState('');
  const [savedPassword, setSavedPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 교사 모드 클릭 시 비밀번호 설정 여부 확인
  const handleTeacherClick = async () => {
    setIsLoading(true);
    setError('');
    try {
      const authDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'auth');
      const docSnap = await getDoc(authDocRef);
      if (docSnap.exists() && docSnap.data().teacherPassword) {
        setSavedPassword(docSnap.data().teacherPassword);
        setModalState('enter');
      } else {
        setModalState('set');
      }
    } catch (err) {
      console.error("Auth check error:", err);
      setError('접근 권한을 확인하는 데 실패했습니다.');
    }
    setIsLoading(false);
  };

  // 비밀번호 제출 핸들러
  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      setError('비밀번호를 입력해주세요.');
      return;
    }
    setIsLoading(true);
    setError('');
    
    if (modalState === 'set') {
      try {
        const authDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'auth');
        await setDoc(authDocRef, { teacherPassword: password });
        setAppMode('teacher');
      } catch (err) {
        console.error("Save password error:", err);
        setError('비밀번호 저장 중 오류가 발생했습니다.');
      }
    } else if (modalState === 'enter') {
      if (password === savedPassword) {
        setAppMode('teacher');
      } else {
        setError('비밀번호가 일치하지 않습니다.');
      }
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileText size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">스마트 자동 채점 도구</h1>
        <p className="text-gray-500 mb-8">역할을 선택해주세요.</p>
        
        <div className="space-y-4">
          <button 
            onClick={handleTeacherClick}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                <User size={24} />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-gray-800 flex items-center">
                  교사 모드 <Lock size={14} className="ml-2 text-indigo-400" />
                </h3>
                <p className="text-sm text-gray-500">시험지 출제 및 결과 확인</p>
              </div>
            </div>
            <ChevronRight className="text-gray-400 group-hover:text-indigo-500" />
          </button>

          <button 
            onClick={() => setAppMode('student')}
            className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
          >
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <GraduationCap size={24} />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-gray-800">학생 모드</h3>
                <p className="text-sm text-gray-500">답안 작성 및 제출</p>
              </div>
            </div>
            <ChevronRight className="text-gray-400 group-hover:text-emerald-500" />
          </button>
        </div>
      </div>

      {/* 하단 제작자 문구 */}
      <div className="absolute bottom-6 text-gray-400 text-sm font-medium">
        삼례동초 호근쌤 v1.0
      </div>

      {/* 비밀번호 모달창 */}
      {modalState !== 'none' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-full">
                <Key size={32} />
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-center text-gray-800 mb-2">
              {modalState === 'set' ? '교사 비밀번호 설정' : '교사 인증'}
            </h2>
            <p className="text-center text-gray-500 text-sm mb-6">
              {modalState === 'set' 
                ? '최초 1회 교사용 접속 비밀번호를 설정합니다.' 
                : '교사 모드에 접근하기 위해 비밀번호를 입력해주세요.'}
            </p>

            <div className="space-y-4">
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                  placeholder="비밀번호 입력"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-center tracking-widest text-lg"
                  autoFocus
                />
                {error && <p className="text-red-500 text-sm mt-2 text-center font-medium">{error}</p>}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => { setModalState('none'); setPassword(''); setError(''); }}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  disabled={isLoading}
                  className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors"
                >
                  {isLoading ? '확인 중...' : '확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. 교사 대시보드
// ==========================================
function TeacherDashboard({ exam, setExam, submissions, setSubmissions, goBack }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create', 'results'

  // 프로그램 초기화 함수
  const handleReset = async () => {
    if (window.confirm("⚠️ 경고: 모든 학생의 제출 답안과 현재 시험지 데이터가 완전히 삭제됩니다.\n새로운 시험을 준비할 때만 사용하세요.\n\n정말 초기화하시겠습니까?")) {
      try {
        // 1. 모든 학생 제출물 삭제
        for (const sub of submissions) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'submissions', sub.id));
        }
        
        // 2. 시험지 데이터 초기화
        const examDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'exams', 'current_exam');
        await setDoc(examDocRef, { title: '', questions: [] });
        
        alert("프로그램이 성공적으로 초기화되었습니다.");
        setActiveTab('create'); // 초기화 후 시험지 관리 탭으로 이동
      } catch (error) {
        console.error("Reset error:", error);
        alert("초기화 중 오류가 발생했습니다.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-800 flex items-center">
            <User className="mr-2 text-indigo-600" size={24} />
            교사 워크스페이스
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'create' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              시험지 관리
            </button>
            <button 
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center ${activeTab === 'results' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              결과 확인
              {submissions.length > 0 && (
                <span className="ml-2 bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs">
                  {submissions.length}
                </span>
              )}
            </button>
          </div>
          
          {/* 초기화 버튼 추가 */}
          <button 
            onClick={handleReset}
            className="flex items-center text-xs font-medium bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
            title="데이터 전체 초기화"
          >
            <RotateCcw size={14} className="mr-1.5" /> 프로그램 초기화
          </button>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'create' ? (
            <ExamEditor exam={exam} setExam={setExam} />
          ) : (
            <ResultsViewer exam={exam} submissions={submissions} setSubmissions={setSubmissions} />
          )}
        </div>
      </main>
    </div>
  );
}

// --- 교사: 시험지 편집기 ---
function ExamEditor({ exam, setExam }) {
  const [editingExam, setEditingExam] = useState(exam || { title: '', questions: [] });
  const [isSaved, setIsSaved] = useState(false);

  const addQuestion = (type) => {
    const newQuestion = {
      id: `q${Date.now()}`,
      type,
      text: '',
      points: 10,
      answer: '',
      ...(type === 'multiple_choice' ? { options: ['', '', '', ''] } : {})
    };
    setEditingExam({ ...editingExam, questions: [...editingExam.questions, newQuestion] });
    setIsSaved(false);
  };

  const updateQuestion = (id, field, value) => {
    const updated = editingExam.questions.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    );
    setEditingExam({ ...editingExam, questions: updated });
    setIsSaved(false);
  };

  const updateOption = (qId, optIndex, value) => {
    const updated = editingExam.questions.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    });
    setEditingExam({ ...editingExam, questions: updated });
    setIsSaved(false);
  };

  const changeOptionCount = (qId, count) => {
    const updated = editingExam.questions.map(q => {
      if (q.id === qId) {
        let newOptions = [...q.options];
        if (count > newOptions.length) {
          // 옵션 추가 (5지 선다로 변경 시)
          while (newOptions.length < count) newOptions.push('');
        } else if (count < newOptions.length) {
          // 옵션 삭제 (4지 선다로 변경 시)
          newOptions = newOptions.slice(0, count);
        }
        
        // 만약 삭제된 옵션이 기존 정답이었다면 정답 위치를 마지막 번호로 조정
        let newAnswer = q.answer;
        if (newAnswer !== "" && Number(newAnswer) >= count) {
          newAnswer = String(count - 1);
        }
        
        return { ...q, options: newOptions, answer: newAnswer };
      }
      return q;
    });
    setEditingExam({ ...editingExam, questions: updated });
    setIsSaved(false);
  };

  const removeQuestion = (id) => {
    setEditingExam({
      ...editingExam,
      questions: editingExam.questions.filter(q => q.id !== id)
    });
    setIsSaved(false);
  };

  const handleSave = async () => {
    try {
      const examDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'exams', 'current_exam');
      await setDoc(examDocRef, editingExam);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Save error:", error);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <label className="block text-sm font-semibold text-gray-700 mb-2">시험지 제목</label>
        <input 
          type="text" 
          value={editingExam.title}
          onChange={(e) => { setEditingExam({...editingExam, title: e.target.value}); setIsSaved(false); }}
          className="w-full text-xl p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          placeholder="예: 1학기 기말고사"
        />
      </div>

      <div className="space-y-4">
        {editingExam.questions.map((q, index) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 relative group">
            <button 
              onClick={() => removeQuestion(q.id)}
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={18} />
            </button>
            
            <div className="flex items-center space-x-3 mb-3">
              <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-3 py-1 rounded-full">
                문제 {index + 1}
              </span>
              <span className="text-xs font-medium text-gray-500">
                {q.type === 'multiple_choice' && '객관식'}
                {q.type === 'short_answer' && '단답형'}
                {q.type === 'essay' && '서술형'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
              <div className="md:col-span-3">
                <label className="block text-[11px] text-gray-500 mb-1">문제 내용 (교사용 메모 - 학생에겐 보이지 않음)</label>
                <textarea 
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-16"
                  placeholder="문제를 입력하세요"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">배점</label>
                <input 
                  type="number" 
                  value={q.points}
                  onChange={(e) => updateQuestion(q.id, 'points', Number(e.target.value))}
                  className="w-full p-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* 객관식 옵션 */}
            {q.type === 'multiple_choice' && (
              <div className="mb-3 bg-gray-50 p-3 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[11px] text-gray-500 font-semibold">정답 선택 및 보기 개수 (학생 OMR 생성용)</label>
                  <div className="flex space-x-1">
                    <button 
                      onClick={() => changeOptionCount(q.id, 4)}
                      className={`px-3 py-1 text-xs rounded border transition-colors ${q.options.length === 4 ? 'bg-indigo-500 border-indigo-600 text-white font-bold' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                    >
                      4지 선다
                    </button>
                    <button 
                      onClick={() => changeOptionCount(q.id, 5)}
                      className={`px-3 py-1 text-xs rounded border transition-colors ${q.options.length === 5 ? 'bg-indigo-500 border-indigo-600 text-white font-bold' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                    >
                      5지 선다
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center space-x-2 flex-1 min-w-[120px] bg-white p-2 rounded-lg border border-gray-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                      <input 
                        type="radio" 
                        name={`answer-${q.id}`} 
                        checked={q.answer === String(optIdx)}
                        onChange={() => updateQuestion(q.id, 'answer', String(optIdx))}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 flex-shrink-0 cursor-pointer"
                      />
                      <span 
                        className="font-bold text-gray-600 text-sm whitespace-nowrap flex-shrink-0 cursor-pointer" 
                        onClick={() => updateQuestion(q.id, 'answer', String(optIdx))}
                      >
                        {optIdx + 1}번
                      </span>
                      <input 
                        type="text" 
                        value={opt}
                        onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                        className="w-full p-1 text-sm border-none bg-transparent outline-none"
                        placeholder="메모"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 단답형 정답 */}
            {q.type === 'short_answer' && (
              <div className="mb-1">
                <label className="block text-[11px] text-gray-500 mb-1">정답 (자동 채점용)</label>
                <input 
                  type="text" 
                  value={q.answer}
                  onChange={(e) => updateQuestion(q.id, 'answer', e.target.value)}
                  className="w-full p-2.5 text-sm border border-emerald-300 bg-emerald-50 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="정확한 정답을 입력하세요"
                />
              </div>
            )}
            
            {/* 서술형 안내 */}
            {q.type === 'essay' && (
              <div className="p-2.5 bg-amber-50 text-amber-700 text-xs rounded-lg flex items-start">
                <AlertCircle size={14} className="mr-1.5 mt-0.5 flex-shrink-0" />
                <p>서술형은 제출 후 교사가 직접 읽고 수동으로 채점해야 합니다.</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 문제 추가 버튼들 */}
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={() => addQuestion('multiple_choice')}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
        >
          <Plus size={16} className="mr-2 text-indigo-500" /> 객관식 추가
        </button>
        <button 
          onClick={() => addQuestion('short_answer')}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
        >
          <Plus size={16} className="mr-2 text-emerald-500" /> 단답형 추가
        </button>
        <button 
          onClick={() => addQuestion('essay')}
          className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
        >
          <Plus size={16} className="mr-2 text-amber-500" /> 서술형 추가
        </button>
      </div>

      {/* 하단 고정 저장 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-center shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] z-20">
        <button 
          onClick={handleSave}
          className="flex items-center px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-colors"
        >
          {isSaved ? <Check size={20} className="mr-2" /> : <Save size={20} className="mr-2" />}
          {isSaved ? '저장되었습니다!' : '시험지 배포하기 (저장)'}
        </button>
      </div>
    </div>
  );
}

// --- 교사: 결과 확인 뷰어 ---
function ResultsViewer({ exam, submissions, setSubmissions }) {
  const [selectedSub, setSelectedSub] = useState(null);

  if (!exam || !exam.questions.length) {
    return <div className="text-center p-10 text-gray-500">배포된 시험지가 없습니다.</div>;
  }

  if (submissions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="text-gray-400" size={32} />
        </div>
        <h3 className="text-lg font-medium text-gray-800 mb-1">제출된 답안이 없습니다</h3>
        <p className="text-gray-500">학생들이 답안을 제출하면 이곳에 표시됩니다.</p>
      </div>
    );
  }

  const handleManualGrade = async (subId, qId, score) => {
    const sub = submissions.find(s => s.id === subId);
    if (!sub) return;

    const newDetails = { ...sub.details };
    newDetails[qId] = { ...newDetails[qId], awardedPoints: Number(score), isManual: true };
    
    // 총점 다시 계산
    const newTotal = Object.values(newDetails).reduce((sum, detail) => sum + (detail.awardedPoints || 0), 0);
    
    try {
      const subDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'submissions', subId);
      await updateDoc(subDocRef, {
        details: newDetails,
        totalScore: newTotal
      });
      
      if (selectedSub && selectedSub.id === subId) {
        setSelectedSub({ ...sub, details: newDetails, totalScore: newTotal });
      }
    } catch (error) {
      console.error("Manual grade error:", error);
    }
  };

  const exportToCSV = () => {
    if (submissions.length === 0) return;

    // 1. 헤더 생성
    const headers = ['이름', '제출일시', '총점', '만점'];
    exam.questions.forEach((q, idx) => {
      headers.push(`Q${idx + 1}(${q.points}점)`);
    });

    // 2. 데이터 행 생성
    const rows = submissions.map(sub => {
      const row = [
        sub.studentName,
        new Date(sub.timestamp).toLocaleString(),
        sub.totalScore,
        sub.maxScore
      ];
      
      exam.questions.forEach(q => {
        const detail = sub.details[q.id];
        row.push(detail ? detail.awardedPoints : 0);
      });
      
      // 쉼표 등 특수문자 처리를 위해 각 필드를 따옴표로 감싸기
      return row.map(cell => `"${cell}"`).join(',');
    });

    // 3. CSV 문자열 결합 (BOM '\uFEFF'을 추가하여 엑셀에서 한글 깨짐 방지)
    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    
    // 4. 다운로드 트리거
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exam.title}_채점결과.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* 학생 목록 리스트 */}
      <div className="w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b bg-gray-50 font-semibold text-gray-700 flex justify-between items-center">
          <span>제출자 목록 ({submissions.length})</span>
          <button 
            onClick={exportToCSV}
            className="flex items-center text-xs bg-white border border-gray-300 text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            title="결과 엑셀 다운로드"
          >
            <Download size={14} className="mr-1" /> 다운로드
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {submissions.map((sub, idx) => {
            const needsReview = Object.keys(sub.details).some(k => 
              exam.questions.find(q => q.id === k)?.type === 'essay' && !sub.details[k].isManual
            );
            
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSub(sub)}
                className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors flex justify-between items-center ${selectedSub?.id === sub.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
              >
                <div>
                  <div className="font-bold text-gray-800">{sub.studentName}</div>
                  <div className="text-xs text-gray-500 mt-1">제출 시간: {new Date(sub.timestamp).toLocaleTimeString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-indigo-600">{sub.totalScore} / {sub.maxScore}점</div>
                  {needsReview && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full inline-block mt-1">채점 필요</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 개별 학생 상세 채점 결과 */}
      <div className="w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-6">
        {selectedSub ? (
          <div>
            <div className="border-b pb-4 mb-6 flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{selectedSub.studentName} 학생의 답안</h2>
                <p className="text-gray-500 mt-1">{exam.title}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 mb-1">총점</div>
                <div className="text-3xl font-black text-indigo-600">{selectedSub.totalScore}<span className="text-lg text-gray-400 font-medium">/{selectedSub.maxScore}</span></div>
              </div>
            </div>

            <div className="space-y-6">
              {exam.questions.map((q, idx) => {
                const answerObj = selectedSub.details[q.id] || { awardedPoints: 0, isCorrect: false };
                const studentAnswer = selectedSub.answers[q.id] || "미응답";
                const isEssay = q.type === 'essay';

                return (
                  <div key={q.id} className={`p-5 rounded-xl border ${isEssay ? 'border-amber-200 bg-amber-50/30' : answerObj.isCorrect ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-700">Q{idx + 1}.</span>
                        <span className="text-gray-800">{q.text}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-500 bg-white px-2 py-1 rounded border">배점: {q.points}</span>
                    </div>

                    <div className="pl-6 space-y-3">
                      {/* 학생의 답안 표시 */}
                      <div className="bg-white p-3 rounded-lg border shadow-sm">
                        <span className="text-xs text-gray-500 block mb-1">학생 제출 답안:</span>
                        <div className="font-medium text-gray-800">
                          {q.type === 'multiple_choice' 
                            ? (studentAnswer && studentAnswer !== "미응답" ? `${Number(studentAnswer) + 1}번` : "미응답")
                            : studentAnswer}
                        </div>
                      </div>

                      {/* 자동 채점 결과 / 정답 표시 */}
                      {!isEssay && (
                        <div className="flex items-center space-x-2 text-sm mt-3">
                          {answerObj.isCorrect ? (
                            <><CheckCircle size={18} className="text-emerald-500" /> <span className="text-emerald-700 font-medium">정답입니다. (+{answerObj.awardedPoints}점)</span></>
                          ) : (
                            <><AlertCircle size={18} className="text-red-500" /> 
                              <span className="text-red-700 font-medium">오답입니다. (0점)</span>
                              <span className="text-gray-500 ml-2">/ 정답: {q.type === 'multiple_choice' ? `${Number(q.answer) + 1}번` : q.answer}</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* 서술형 수동 채점 영역 */}
                      {isEssay && (
                        <div className="mt-4 p-4 bg-amber-100/50 rounded-lg border border-amber-200 flex items-center justify-between">
                          <span className="text-amber-800 font-medium text-sm flex items-center">
                            <AlertCircle size={16} className="mr-1" />
                            교사 수동 채점
                          </span>
                          <div className="flex items-center space-x-2">
                            <input 
                              type="number" 
                              min="0" 
                              max={q.points}
                              value={answerObj.awardedPoints}
                              onChange={(e) => handleManualGrade(selectedSub.id, q.id, e.target.value)}
                              className="w-20 p-2 text-center border-2 border-amber-300 rounded-md focus:outline-none focus:border-amber-500 bg-white font-bold text-amber-700"
                            />
                            <span className="text-gray-500">/ {q.points}점</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            좌측에서 학생을 선택하면 상세 채점 결과를 볼 수 있습니다.
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 3. 학생 화면
// ==========================================
function StudentDashboard({ exam, submitExam, goBack }) {
  const [studentName, setStudentName] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!exam || !exam.questions || exam.questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center bg-white p-10 rounded-2xl shadow-sm border border-gray-200">
          <AlertCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">등록된 시험지가 없습니다</h2>
          <p className="text-gray-500 mb-6">교사가 시험지를 배포한 후 다시 시도해주세요.</p>
          <button onClick={goBack} className="px-6 py-2 bg-gray-100 rounded-lg text-gray-700 hover:bg-gray-200 transition-colors">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 제출 완료 화면
  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-6">
        <div className="text-center bg-white p-10 rounded-2xl shadow-xl max-w-md w-full border border-emerald-100">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">제출 완료!</h2>
          <p className="text-gray-600 mb-8">답안이 성공적으로 제출되었습니다. <br/>자동 채점 결과가 교사에게 전달되었습니다.</p>
          <button onClick={goBack} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">
            초기 화면으로
          </button>
        </div>
      </div>
    );
  }

  // 이름 입력 화면 (시험 전)
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <button onClick={goBack} className="absolute top-6 left-6 p-2 bg-white shadow-sm rounded-full text-gray-500 hover:text-gray-800">
          <ArrowLeft size={20} />
        </button>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="inline-block p-3 bg-emerald-100 text-emerald-600 rounded-2xl mb-6">
            <FileText size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{exam.title}</h1>
          <p className="text-gray-500 mb-8">시험을 시작하려면 이름을 입력해주세요.</p>
          
          <input 
            type="text" 
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="이름 (예: 홍길동)"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl mb-6 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-lg text-center"
          />
          
          <button 
            disabled={!studentName.trim()}
            onClick={() => setIsStarted(true)}
            className="w-full flex items-center justify-center py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <Play size={20} className="mr-2" /> 시험 시작하기
          </button>
        </div>
      </div>
    );
  }

  // 답안 선택 핸들러
  const handleAnswerChange = (qId, value) => {
    setAnswers({ ...answers, [qId]: value });
  };

  // 제출 및 자동 채점 로직
  const handleSubmit = () => {
    let totalScore = 0;
    let maxScore = 0;
    const details = {};

    exam.questions.forEach(q => {
      maxScore += q.points;
      const studentAns = answers[q.id] || "";
      let isCorrect = false;
      let awardedPoints = 0;

      if (q.type === 'multiple_choice') {
        isCorrect = studentAns === q.answer;
        awardedPoints = isCorrect ? q.points : 0;
      } else if (q.type === 'short_answer') {
        // 공백 제거 및 소문자 변환하여 비교 (간단한 자동 채점 로직)
        isCorrect = studentAns.trim().toLowerCase() === q.answer.trim().toLowerCase();
        awardedPoints = isCorrect ? q.points : 0;
      } else if (q.type === 'essay') {
        // 서술형은 무조건 0점 처리 (교사가 나중에 수동 채점)
        isCorrect = false;
        awardedPoints = 0;
      }

      totalScore += awardedPoints;
      details[q.id] = {
        studentAnswer: studentAns,
        isCorrect,
        awardedPoints,
        isManual: false // 서술형 채점 여부 추적용
      };
    });

    const submissionData = {
      studentName,
      timestamp: Date.now(),
      answers,
      details,
      totalScore,
      maxScore
    };

    submitExam(submissionData);
    setIsSubmitted(true);
  };

  // 시험 보는 화면
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center text-emerald-600 font-bold">
          <GraduationCap size={24} className="mr-2" /> 학생 모드
        </div>
        <div className="font-bold text-gray-800 text-lg">
          {exam.title}
        </div>
        <div className="text-gray-500 font-medium">
          응시자: <span className="text-gray-800">{studentName}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 pb-32">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
          <div className="text-center border-b pb-6 mb-6">
            <h2 className="text-2xl font-black text-gray-800 tracking-wider">OMR 및 서답형 답안지</h2>
            <p className="text-gray-500 mt-2">종이 시험지의 문제 번호에 맞춰 답안을 작성해주세요.</p>
          </div>
          
          <div className="space-y-1">
            {exam.questions.map((q, idx) => (
              <div key={q.id} className="flex flex-col md:flex-row md:items-center py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors px-3 rounded-lg">
                <div className="w-24 font-bold text-lg text-gray-800 mb-2 md:mb-0 flex items-center">
                  <span className="text-emerald-600 mr-1">{idx + 1}</span>번
                  <span className="text-[10px] font-normal text-gray-400 ml-2 border px-1.5 py-0.5 rounded">{q.points}점</span>
                </div>

                <div className="flex-1">
                  {/* 객관식 입력 (OMR 스타일) */}
                  {q.type === 'multiple_choice' && (
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((_, optIdx) => (
                        <label 
                          key={optIdx} 
                          className={`relative w-10 h-10 flex items-center justify-center rounded-full border-2 cursor-pointer transition-all duration-200 ${answers[q.id] === String(optIdx) ? 'border-emerald-500 bg-emerald-500 text-white font-bold shadow-md transform scale-105' : 'border-gray-300 bg-white text-gray-600 hover:border-emerald-400 hover:bg-emerald-50'}`}
                        >
                          <input 
                            type="radio" 
                            name={`q-${q.id}`} 
                            value={String(optIdx)}
                            checked={answers[q.id] === String(optIdx)}
                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                            className="absolute opacity-0 w-0 h-0"
                          />
                          <span className="text-base">{optIdx + 1}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 단답형 입력 */}
                  {q.type === 'short_answer' && (
                    <input 
                      type="text" 
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder="정답 입력"
                      className="w-full max-w-md p-2.5 text-base border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:bg-emerald-50 focus:ring-0 outline-none transition-colors"
                    />
                  )}

                  {/* 서술형 입력 */}
                  {q.type === 'essay' && (
                    <textarea 
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder="서술형 답안을 입력하세요"
                      className="w-full p-3 text-sm border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:bg-emerald-50 focus:ring-0 outline-none transition-colors min-h-[80px] resize-y"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* 하단 고정 제출 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t p-4 flex justify-center shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.1)] z-20">
        <div className="max-w-3xl w-full flex justify-between items-center px-4">
          <div className="text-gray-500 font-medium">
            응답 완료: {Object.keys(answers).length} / {exam.questions.length} 문항
          </div>
          <button 
            onClick={handleSubmit}
            className="px-10 py-3 bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-emerald-700 hover:shadow-xl transition-all flex items-center"
          >
            답안 최종 제출 <ChevronRight size={20} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}