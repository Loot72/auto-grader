import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Settings, 
  User, 
  Users, 
  ChevronRight, 
  BookOpen, 
  FileText,
  AlertCircle,
  Play,
  ArrowLeft,
  Lock,
  Unlock,
  Key,
  Download,
  RotateCcw,
  Eye,
  EyeOff,
  Layout,
  ClipboardCheck,
  Home,
  Plus,
  Trash2,
  Share2,
  Copy,
  DownloadCloud
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, getDoc, deleteDoc } from 'firebase/firestore';

// ==========================================
// Firebase 초기화 (캔버스 전용 설정)
// ==========================================
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

// ==========================================
// 공통 UI: 커스텀 다이얼로그 (alert, confirm 대체)
// ==========================================
function CustomDialog({ dialog, setDialog }) {
  if (!dialog.isOpen) return null;
  return (
    <div className="fixed inset-0 bg-indigo-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl p-8 max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
        <h3 className={`text-2xl font-black mb-4 ${dialog.title === '경고' || dialog.title === '오류' ? 'text-red-500' : 'text-gray-800'}`}>
          {dialog.title}
        </h3>
        <p className="text-gray-600 mb-8 font-medium leading-relaxed whitespace-pre-wrap">{dialog.message}</p>
        <div className="flex gap-3 justify-center">
          {dialog.type === 'confirm' && (
            <button 
              onClick={dialog.onCancel} 
              className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 font-bold transition-colors"
            >
              취소
            </button>
          )}
          <button 
            onClick={dialog.onConfirm} 
            className={`flex-1 py-4 text-white font-bold rounded-2xl transition-colors shadow-lg ${dialog.title === '경고' || dialog.title === '오류' ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 1. 학생 화면 (선택된 방의 데이터 사용)
// ==========================================
function StudentScreen({ exam, user, selectedRoom, goBack }) {
  const [studentName, setStudentName] = useState('');
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState([]);
  const [dialog, setDialog] = useState({ isOpen: false });

  const showDialog = (title, message, type = 'alert', onConfirm = null, onCancel = null) => {
    setDialog({
      isOpen: true, title, message, type,
      onConfirm: onConfirm || (() => setDialog({ isOpen: false })),
      onCancel: onCancel || (() => setDialog({ isOpen: false }))
    });
  };

  if (!exam || !exam.questions || exam.questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <AlertCircle size={48} className="text-gray-400 mb-4" />
        <h2 className="text-xl font-bold text-gray-700">현재 대기 중인 시험이 없습니다.</h2>
        <p className="text-gray-500 mt-2 text-center">선생님께서 시험을 시작하실 때까지 기다려주세요.</p>
        <button onClick={goBack} className="mt-6 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700">방 목록으로 돌아가기</button>
      </div>
    );
  }

  const isTestMode = exam.mode === 'test';

  const handleAnswerChange = (questionId, value) => {
    setAnswers({ ...answers, [questionId]: value });
  };

  const executeSubmit = async () => {
    let calculatedScore = 0;
    let newFeedback = [];

    exam.questions.forEach((q, index) => {
      let isCorrect = false;
      let displayStudentAnswer = "미입력";
      let displayCorrectAnswer = "미설정";

      if (q.type === 'multiple') {
        const studentAnsIdx = answers[q.id];
        const correctAnsIdx = q.correctAnswer;
        
        if (studentAnsIdx !== undefined && studentAnsIdx === correctAnsIdx) {
          isCorrect = true;
          calculatedScore += q.score;
        }
        
        displayStudentAnswer = studentAnsIdx !== undefined ? `${Number(studentAnsIdx) + 1}번` : "미입력";
        displayCorrectAnswer = correctAnsIdx ? `${Number(correctAnsIdx) + 1}번` : "미설정";
      } else {
        const originalStudentAnswer = String(answers[q.id] || "");
        const studentAnswerClean = originalStudentAnswer.replace(/\s+/g, '').toLowerCase();
        
        const correctAnswersList = String(q.correctAnswer || "")
          .split(',')
          .map(ans => ans.replace(/\s+/g, '').toLowerCase())
          .filter(ans => ans !== "");

        isCorrect = correctAnswersList.includes(studentAnswerClean) && studentAnswerClean !== "";
        if (isCorrect) calculatedScore += q.score;
        
        displayStudentAnswer = originalStudentAnswer || "미입력";
        displayCorrectAnswer = q.correctAnswer || "미설정";
      }
      
      newFeedback.push({
        questionNumber: index + 1,
        question: isTestMode && q.text ? q.text : `문제 ${index + 1}`,
        studentAnswer: displayStudentAnswer,
        correctAnswer: displayCorrectAnswer,
        isCorrect: isCorrect,
        score: isCorrect ? q.score : 0,
        maxScore: q.score
      });
    });

    try {
      if (user) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `submissions_${selectedRoom}`), {
          studentName,
          score: calculatedScore,
          feedback: newFeedback,
          submittedAt: new Date().toISOString()
        });
        
        setScore(calculatedScore);
        setFeedback(newFeedback);
        setSubmitted(true);
      }
    } catch (error) {
      console.error("Submission error:", error);
      showDialog('오류', '제출 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = () => {
    if (!studentName.trim()) {
      showDialog('알림', '이름을 정확히 입력해주세요.');
      return;
    }
    if (Object.keys(answers).length < exam.questions.length) {
      showDialog('확인', '아직 풀지 않은 문제가 있습니다.\n정말 제출하시겠습니까?', 'confirm', 
        () => { setDialog({isOpen: false}); executeSubmit(); }
      );
      return;
    }
    executeSubmit();
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white shadow-lg rounded-xl mt-8 animate-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">{studentName} 학생, 제출 완료!</h2>
          <p className="text-4xl font-extrabold text-indigo-600 mt-4">{score} <span className="text-xl text-gray-500 font-medium">/ 100 점</span></p>
        </div>

        <div className="space-y-4">
          <h3 className="font-bold text-lg border-b pb-2">채점 결과 상세</h3>
          {feedback.map((item, index) => (
            <div key={index} className={`p-4 rounded-lg border ${item.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="font-bold">문제 {item.questionNumber}.</span>
                <span className={`font-bold flex items-center ${item.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                  {item.isCorrect ? <CheckCircle size={16} className="mr-1" /> : <XCircle size={16} className="mr-1" />}
                  {item.isCorrect ? `+${item.score}점` : '0점'}
                </span>
              </div>
              {isTestMode && item.question !== `문제 ${item.questionNumber}` && (
                <p className="text-gray-700 mb-3 text-sm">{item.question}</p>
              )}
              <div className="text-sm mt-2">
                <p className="mb-1"><span className="text-gray-500 w-16 inline-block">나의 답:</span> <span className="font-medium">{item.studentAnswer}</span></p>
                {!item.isCorrect && (
                  <p><span className="text-gray-500 w-16 inline-block">정답:</span> <span className="font-bold text-indigo-600">{item.correctAnswer}</span></p>
                )}
              </div>
            </div>
          ))}
        </div>
        <button onClick={goBack} className="mt-8 w-full py-4 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-colors">
          방 목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <button onClick={goBack} className="flex items-center text-gray-500 hover:text-indigo-600 self-start bg-white px-4 py-2 rounded-lg shadow-sm">
          <ArrowLeft size={18} className="mr-2" /> 나가기
        </button>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-gray-800 flex items-center justify-center">
            {isTestMode ? <ClipboardCheck className="mr-2 text-emerald-500" /> : <BookOpen className="mr-2 text-indigo-600" />}
            {exam.title || "온라인 평가"}
          </h1>
          <div className="mt-2">
            <span className={`text-xs px-3 py-1 rounded-full font-bold shadow-sm ${isTestMode ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {isTestMode ? "문제 풀이 모드" : "답안 전송 모드"}
            </span>
          </div>
        </div>
        <div className="hidden sm:block w-24"></div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm mb-6 border border-gray-100 border-t-4 border-t-indigo-500">
        <label className="block text-sm font-bold text-gray-700 mb-2">학생 이름</label>
        <input
          type="text"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          placeholder="이름을 입력하세요"
          className="w-full sm:w-1/2 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
        />
      </div>

      <div className="space-y-6">
        {exam.questions.map((q, index) => (
          <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-lg text-gray-800">
                <span className="text-indigo-600 mr-2">{index + 1}번.</span> 
                {isTestMode && q.text ? q.text : "답안을 입력하세요"}
              </h3>
              <span className="bg-indigo-50 text-indigo-600 text-xs px-2 py-1 rounded font-bold whitespace-nowrap ml-4">
                {q.score}점
              </span>
            </div>
            
            {q.type === 'multiple' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
                {q.options.map((opt, i) => (
                  <label key={i} className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${answers[q.id] === String(i) ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'border-gray-100 hover:border-gray-300'}`}>
                    <input
                      type="radio"
                      name={`question_${q.id}`}
                      value={String(i)}
                      checked={answers[q.id] === String(i)}
                      onChange={() => handleAnswerChange(q.id, String(i))}
                      className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <span className={answers[q.id] === String(i) ? 'font-bold text-indigo-900' : 'font-medium text-gray-700'}>
                      {isTestMode && opt ? `${i + 1}. ${opt}` : `${i + 1}번`}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                placeholder="정답 입력"
                className="w-full mt-2 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSubmit}
          className="flex items-center px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all transform hover:-translate-y-1"
        >
          <CheckCircle className="mr-2" />
          답안 최종 제출하기
        </button>
      </div>
      <CustomDialog dialog={dialog} setDialog={setDialog} />
    </div>
  );
}

// ==========================================
// 2. 교사 대시보드 (선택된 방의 데이터 사용)
// ==========================================
function TeacherDashboard({ exam, submissions, selectedRoom, goBack }) {
  const [activeTab, setActiveTab] = useState('create'); 
  const [examTitle, setExamTitle] = useState(exam?.title || '');
  const [questions, setQuestions] = useState(exam?.questions || []);
  const [examMode, setExamMode] = useState(exam?.mode || 'grading');
  const [dialog, setDialog] = useState({ isOpen: false });

  // 코드 기반 공유 전용 상태 관리
  const [shareCodeModal, setShareCodeModal] = useState(false);
  const [loadCodeModal, setLoadCodeModal] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [modalError, setModalError] = useState('');

  const showDialog = (title, message, type = 'alert', onConfirm = null, onCancel = null) => {
    setDialog({ isOpen: true, title, message, type, onConfirm: onConfirm || (() => setDialog({ isOpen: false })), onCancel: onCancel || (() => setDialog({ isOpen: false })) });
  };

  const addQuestion = (type) => {
    const newQuestion = { id: Date.now().toString(), type, text: '', score: 5, correctAnswer: '', ...(type === 'multiple' ? { options: ['', '', '', ''] } : {}) };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id, field, value) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOption = (qId, optIndex, value) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const changeOptionCount = (qId, count) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        let newOptions = [...q.options];
        if (count > newOptions.length) {
          while (newOptions.length < count) newOptions.push('');
        } else if (count < newOptions.length) {
          newOptions = newOptions.slice(0, count);
        }
        
        let newCorrect = q.correctAnswer;
        if (newCorrect && Number(newCorrect) >= count) {
          newCorrect = '';
        }
        return { ...q, options: newOptions, correctAnswer: newCorrect };
      }
      return q;
    }));
  };

  const removeQuestion = (id) => { setQuestions(questions.filter(q => q.id !== id)); };

  const handlePublish = async () => {
    if (!examTitle.trim()) { showDialog('alert', '시험지 제목을 입력해주세요.'); return; }
    if (questions.length === 0) { showDialog('alert', '문제를 추가해주세요.'); return; }

    try {
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', selectedRoom);
      await setDoc(roomRef, {
        title: examTitle,
        questions: questions,
        mode: examMode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      showDialog('성공', `성공적으로 배포되었습니다!\n(${examMode === 'test' ? '문제 풀이 모드' : '답안 전송 모드'})`);
    } catch (error) {
      console.error("Publish error:", error);
      showDialog('오류', '저장 중 오류가 발생했습니다.');
    }
  };

  // 고유 랜덤 6자리 코드 생성기
  const generateShareCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // 1. 코드 기반 클라우드에 시험지 저장
  const handleSaveToCloud = async () => {
    if (!examTitle.trim()) { showDialog('알림', '시험지 제목을 먼저 입력해 주세요.'); return; }
    if (questions.length === 0) { showDialog('알림', '최소 1개 이상의 문항이 존재해야 합니다.'); return; }

    try {
      const code = generateShareCode();
      const sharedDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'shared_exams', code);
      await setDoc(sharedDocRef, {
        title: examTitle,
        questions: questions,
        mode: examMode,
        createdAt: new Date().toISOString()
      });
      setGeneratedCode(code);
      setShareCodeModal(true);
    } catch (error) {
      console.error("Cloud save error:", error);
      showDialog('오류', '공유 코드를 발급하는 중 오류가 발생했습니다.');
    }
  };

  // 2. 입력한 코드로 시험지 가져오기
  const handleLoadFromCloud = async () => {
    const cleanCode = inputCode.toUpperCase().trim();
    if (!cleanCode) { setModalError('공유 코드를 입력해 주세요.'); return; }

    try {
      const sharedDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'shared_exams', cleanCode);
      const docSnap = await getDoc(sharedDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setExamTitle(data.title);
        setQuestions(data.questions);
        setExamMode(data.mode || 'grading');
        setLoadCodeModal(false);
        setInputCode('');
        setModalError('');
        showDialog('불러오기 성공', `[${data.title}] 시험지를 성공적으로 가져왔습니다.`);
      } else {
        setModalError('해당 코드로 등록된 시험지를 찾을 수 없습니다.');
      }
    } catch (error) {
      console.error("Cloud load error:", error);
      setModalError('시험지를 연격 조회하는 중 에러가 발생했습니다.');
    }
  };

  const copyCodeToClipboard = () => {
    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = generatedCode;
    document.body.appendChild(tempTextArea);
    tempTextArea.select();
    document.execCommand('copy');
    document.body.removeChild(tempTextArea);
    showDialog('알림', '공유 코드가 클립보드에 성공적으로 복사되었습니다!');
  };

  const exportToCSV = () => {
    if (submissions.length === 0) { showDialog('알림', '다운로드할 데이터가 없습니다.'); return; }
    let csvContent = "이름,총점,제출시간,";
    const maxQuestions = Math.max(...submissions.map(s => s.feedback.length));
    for (let i = 1; i <= maxQuestions; i++) { csvContent += `${i}번답안,${i}번결과,`; }
    csvContent += "\n";

    submissions.forEach(sub => {
      const date = new Date(sub.submittedAt).toLocaleString();
      let row = `${sub.studentName},${sub.score},"${date}",`;
      sub.feedback.forEach(f => { row += `"${f.studentAnswer}",${f.isCorrect ? 'O' : 'X'},`; });
      csvContent += row + "\n";
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${examTitle || '결과'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeReset = async () => {
    try {
      for (const sub of submissions) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `submissions_${selectedRoom}`, sub.id));
      }
      const roomRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', selectedRoom);
      await setDoc(roomRef, { status: 'available' }); 
      
      showDialog('초기화 완료', '방이 완벽하게 초기화되었습니다.\n목록으로 돌아갑니다.', 'alert', () => {
        setDialog({isOpen: false});
        goBack();
      });
    } catch (error) {
      console.error("Reset error:", error);
      showDialog('오류', '초기화 중 오류가 발생했습니다.');
    }
  };

  const handleReset = () => {
    showDialog('경고', `현재 방(${selectedRoom})의 모든 데이터(비밀번호, 시험지, 학생결과)가 완벽히 삭제되며 방이 '사용 가능' 상태로 반환됩니다.\n\n정말 초기화하시겠습니까?`, 'confirm', 
      () => { setDialog({isOpen: false}); executeReset(); }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-10 gap-4">
        <div className="flex items-center space-x-4">
          <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mr-3">
              <User className="text-indigo-600" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">교사 워크스페이스</h1>
              <p className="text-xs text-gray-500 font-bold">{selectedRoom?.replace('room_', '')}번 방 사용 중</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('create')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              평가 관리
            </button>
            <button 
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${activeTab === 'results' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              결과 확인
              {submissions.length > 0 && <span className="ml-2 bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs">{submissions.length}</span>}
            </button>
          </div>
          <button onClick={handleReset} className="flex items-center text-xs font-bold text-red-500 bg-red-50 px-3 py-2 hover:bg-red-100 rounded-lg transition-colors border border-red-100" title="방 반환 및 초기화">
            <RotateCcw size={14} className="mr-1" /> 방 초기화
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'create' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              
              {/* 코드 기반 공유 보드 */}
              <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 rounded-3xl shadow-xl text-white flex flex-col md:flex-row gap-6 justify-between items-center relative overflow-hidden">
                <div className="relative z-10 text-center md:text-left">
                  <h2 className="text-xl font-black flex items-center justify-center md:justify-start">
                    <Share2 size={22} className="mr-2 text-indigo-400" /> 시험지 무선 공유 스테이션
                  </h2>
                  <p className="text-sm text-indigo-200 mt-1">6자리 전용 코드를 이용해 동료 교사들과 간편하게 시험지를 공유하세요.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto relative z-10">
                  <button 
                    onClick={() => { setLoadCodeModal(true); setModalError(''); }} 
                    className="flex-1 md:flex-none px-5 py-3.5 bg-indigo-800 text-indigo-100 font-bold rounded-2xl hover:bg-indigo-700 transition-colors flex items-center justify-center text-sm"
                  >
                    <DownloadCloud size={16} className="mr-2" /> 코드 입력하기
                  </button>
                  <button 
                    onClick={handleSaveToCloud} 
                    className="flex-1 md:flex-none px-5 py-3.5 bg-indigo-500 text-white font-black rounded-2xl hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center text-sm"
                  >
                    <Share2 size={16} className="mr-2" /> 공유 코드 발급
                  </button>
                </div>
                <div className="absolute right-[-10%] top-[-50%] w-72 h-72 bg-indigo-500 opacity-10 rounded-full blur-3xl"></div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-lg font-bold flex items-center">
                      <Layout size={20} className="mr-2 text-indigo-500" /> 평가 모드 설정
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">학생들에게 문제 내용을 공개할지 선택하세요.</p>
                  </div>
                  <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
                    <button onClick={() => setExamMode('grading')} className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-3 rounded-lg text-sm font-bold transition-all ${examMode === 'grading' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400'}`}>
                      <EyeOff size={16} className="mr-2" /> 답안 전송형
                    </button>
                    <button onClick={() => setExamMode('test')} className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-3 rounded-lg text-sm font-bold transition-all ${examMode === 'test' ? 'bg-white shadow-md text-emerald-600' : 'text-gray-400'}`}>
                      <Eye size={16} className="mr-2" /> 문제 풀이형
                    </button>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-gray-50">
                  <label className="block text-sm font-bold text-gray-700 mb-2">평가 제목</label>
                  <input type="text" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="평가 제목을 입력하세요 (예: 5학년 1학기 사회 단원평가)" className="w-full text-lg p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold" />
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-lg font-bold flex items-center mt-8">
                  <FileText size={20} className="mr-2 text-gray-500" /> 문제 구성 ({questions.length}제)
                </h2>
                
                {examMode === 'grading' && (
                  <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-start">
                    <AlertCircle size={18} className="text-indigo-500 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-700">
                      <strong>답안 전송 모드</strong>가 활성화되어 있습니다. 문제나 보기 내용을 입력할 필요 없이 <strong>정답</strong>과 <strong>배점</strong>만 간편하게 설정하세요!
                    </p>
                  </div>
                )}

                {questions.map((q, index) => (
                  <div key={q.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative group animate-in slide-in-from-left-4">
                    <button onClick={() => removeQuestion(q.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors"><XCircle size={24} /></button>
                    <div className="flex gap-4 mb-4 items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="bg-indigo-600 text-white font-bold w-8 h-8 flex items-center justify-center rounded-lg shadow-sm">{index + 1}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${q.type === 'multiple' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {q.type === 'multiple' ? '객관식' : '주관식'}
                        </span>
                      </div>
                      
                      {q.type === 'multiple' && (
                        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                          <button onClick={() => changeOptionCount(q.id, 4)} className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${q.options.length === 4 ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>4지 선다</button>
                          <button onClick={() => changeOptionCount(q.id, 5)} className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${q.options.length === 5 ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}>5지 선다</button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {examMode === 'test' && (
                        <div>
                          <label className="text-xs font-bold text-gray-400 mb-1 block">문제 내용 (학생 노출용)</label>
                          <input type="text" value={q.text} onChange={(e) => updateQuestion(q.id, 'text', e.target.value)} placeholder="문제 내용을 입력하세요" className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                        </div>
                      )}
                      
                      {examMode === 'test' && q.type === 'multiple' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {q.options.map((opt, i) => (
                            <div key={i} className="flex items-center">
                              <span className="text-gray-400 mr-2 font-bold text-sm">{i + 1}.</span>
                              <input type="text" value={opt} onChange={(e) => updateOption(q.id, i, e.target.value)} placeholder={`보기 ${i + 1} 내용`} className="flex-1 p-2 border border-gray-100 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none bg-white" />
                            </div>
                          ))}
                        </div>
                      )}

                      <div className={`flex gap-4 p-4 rounded-xl mt-4 border ${examMode === 'grading' ? 'bg-gray-50 border-gray-200' : 'bg-indigo-50/50 border-indigo-100'}`}>
                        <div className="flex-1">
                          <label className={`block text-xs font-bold mb-1 ${examMode === 'grading' ? 'text-gray-600' : 'text-indigo-700'}`}>정답 설정</label>
                          {q.type === 'multiple' ? (
                            <select value={q.correctAnswer} onChange={(e) => updateQuestion(q.id, 'correctAnswer', e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white font-medium">
                              <option value="">정답 선택</option>
                              {q.options.map((opt, i) => ( 
                                <option key={i} value={String(i)}>
                                  {i + 1}번 {examMode === 'test' && opt ? `- ${opt}` : ''}
                                </option> 
                              ))}
                            </select>
                          ) : (
                            <div>
                              <input type="text" value={q.correctAnswer} onChange={(e) => updateQuestion(q.id, 'correctAnswer', e.target.value)} placeholder="쉼표(,)로 복수 정답 구분 (예: 세종대왕, 세종)" className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white font-medium mb-1" />
                              <p className="text-[10px] text-gray-500 leading-tight">※ 띄어쓰기는 자동 보정됩니다. 여러 정답을 인정하려면 쉼표로 구분하세요.</p>
                            </div>
                          )}
                        </div>
                        <div className="w-24">
                          <label className={`block text-xs font-bold mb-1 ${examMode === 'grading' ? 'text-gray-600' : 'text-indigo-700'}`}>배점</label>
                          <input type="number" value={q.score} onChange={(e) => updateQuestion(q.id, 'score', Number(e.target.value))} className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white text-center font-medium" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button onClick={() => addQuestion('multiple')} className="flex-1 py-4 border-2 border-dashed border-amber-300 text-amber-600 rounded-2xl font-bold hover:bg-amber-50 transition-colors flex items-center justify-center">
                  <span className="text-xl mr-2">+</span> 객관식 문항 추가
                </button>
                <button onClick={() => addQuestion('text')} className="flex-1 py-4 border-2 border-dashed border-blue-300 text-blue-600 rounded-2xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center">
                  <span className="text-xl mr-2">+</span> 주관식 문항 추가
                </button>
              </div>

              <div className="mt-8 bg-indigo-900 rounded-3xl p-8 text-white flex flex-col sm:flex-row items-center justify-between shadow-2xl gap-6">
                <div>
                  <h3 className="font-extrabold text-xl">평가 배포 준비 완료</h3>
                  <p className="text-indigo-300 text-sm mt-1">현재 모드: <span className="text-white font-bold">{examMode === 'test' ? '문제 풀이' : '답안 전송'}</span></p>
                </div>
                <button onClick={handlePublish} className="w-full sm:w-auto px-10 py-4 bg-white text-indigo-900 font-black rounded-2xl shadow-lg hover:bg-indigo-50 transition-all transform hover:-translate-y-1 flex items-center justify-center">
                  <Play size={20} className="mr-2" /> 지금 배포하기
                </button>
              </div>
            </div>
          )}

          {activeTab === 'results' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center text-gray-800">
                    <Users size={24} className="mr-2 text-indigo-600" /> 제출 현황
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">총 {submissions.length}명이 제출함</p>
                </div>
                <button onClick={exportToCSV} className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-bold text-sm shadow-md">
                  <Download size={16} className="mr-2" /> 결과 엑셀 다운로드
                </button>
              </div>

              {submissions.length === 0 ? (
                <div className="bg-white p-16 rounded-3xl shadow-sm text-center border border-gray-100">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen size={32} className="text-gray-300" />
                  </div>
                  <p className="text-gray-400 font-medium">아직 제출한 학생이 없습니다.</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-wider">
                          <th className="p-4 text-center">순서</th>
                          <th className="p-4">학생 이름</th>
                          <th className="p-4">최종 점수</th>
                          <th className="p-4">제출 시각</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submissions.map((sub, index) => (
                          <tr key={sub.id} className="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors">
                            <td className="p-4 text-center text-gray-400 font-medium text-sm">{index + 1}</td>
                            <td className="p-4 font-bold text-gray-800">{sub.studentName}</td>
                            <td className="p-4 font-black text-indigo-600">{sub.score}점</td>
                            <td className="p-4 text-xs text-gray-400">
                              {new Date(sub.submittedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute:'2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* 1. 공유 코드 생성 완료 모달 */}
      {shareCodeModal && (
        <div className="fixed inset-0 bg-indigo-900/40 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] shadow-2xl p-10 max-w-sm w-full relative text-center animate-in zoom-in-95 duration-200">
            <button onClick={() => setShareCodeModal(false)} className="absolute top-6 right-6 text-gray-300 hover:text-gray-500"><XCircle size={24} /></button>
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Share2 size={28} />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">공유 코드 발급 완료!</h2>
            <p className="text-sm text-gray-400 font-bold mb-6">아래 코드를 동료 교사에게 전달해 주세요.</p>
            
            <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 flex items-center justify-between mb-8">
              <span className="text-3xl font-black text-indigo-900 tracking-wider font-mono">{generatedCode}</span>
              <button 
                onClick={copyCodeToClipboard}
                className="p-2.5 bg-white text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors shadow-sm"
                title="복사하기"
              >
                <Copy size={18} />
              </button>
            </div>

            <button
              onClick={() => setShareCodeModal(false)}
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 2. 공유 코드 입력 모달 */}
      {loadCodeModal && (
        <div className="fixed inset-0 bg-indigo-900/40 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] shadow-2xl p-10 max-w-sm w-full relative text-center animate-in zoom-in-95 duration-200">
            <button onClick={() => setLoadCodeModal(false)} className="absolute top-6 right-6 text-gray-300 hover:text-gray-500"><XCircle size={24} /></button>
            <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <DownloadCloud size={28} />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">시험지 원격 가져오기</h2>
            <p className="text-sm text-gray-400 font-bold mb-8">전달받으신 6자리 공유 코드를 입력해 주세요.</p>
            
            <div className="relative mb-2">
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoadFromCloud()}
                placeholder="6자리 코드 입력"
                className="w-full py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-2xl tracking-widest text-center uppercase text-indigo-900 placeholder:text-gray-300"
                maxLength={6}
                autoFocus
              />
            </div>

            <div className="h-6 mb-4 flex items-center justify-center">
              {modalError && <p className="text-red-500 text-xs font-bold animate-in fade-in">{modalError}</p>}
            </div>

            <button
              onClick={handleLoadFromCloud}
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              불러오기
            </button>
          </div>
        </div>
      )}

      <CustomDialog dialog={dialog} setDialog={setDialog} />
    </div>
  );
}

// ==========================================
// 최상위 App 컴포넌트 (방 목록 및 네비게이션 관리)
// ==========================================
export default function App() {
  const [appMode, setAppMode] = useState('home'); 
  const [userRole, setUserRole] = useState('none'); 
  const [user, setUser] = useState(null);
  
  const [rooms, setRooms] = useState({});
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomExamData, setRoomExamData] = useState(null);
  const [submissions, setSubmissions] = useState([]);

  const [modalState, setModalState] = useState('none'); 
  const [targetRoom, setTargetRoom] = useState(null);
  const [roomPassword, setRoomPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [appDialog, setAppDialog] = useState({ isOpen: false });

  const showAppDialog = (title, message) => setAppDialog({ isOpen: true, title, message, type: 'alert', onConfirm: () => setAppDialog({isOpen: false}) });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) { console.error(e); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'rooms'), (snap) => {
      const roomData = {};
      snap.forEach(doc => { roomData[doc.id] = doc.data(); });
      setRooms(roomData);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedRoom || appMode !== 'dashboard') return;
    
    const unsubExam = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', selectedRoom), (docSnap) => {
      if (docSnap.exists() && docSnap.data().status === 'in_use') {
        setRoomExamData(docSnap.data());
      } else {
        setRoomExamData(null); 
      }
    });
    
    const unsubSub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', `submissions_${selectedRoom}`), (snapshot) => {
      const subs = [];
      snapshot.forEach(d => subs.push({ id: d.id, ...d.data() }));
      subs.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setSubmissions(subs);
    });

    return () => { unsubExam(); unsubSub(); };
  }, [user, selectedRoom, appMode]);

  const handleRoomClick = (roomId, roomData) => {
    const status = roomData?.status || 'available';

    if (userRole === 'teacher') {
      setTargetRoom({ id: roomId, data: roomData });
      if (status === 'in_use') {
        setModalState('enter_room_pw'); 
      } else {
        setModalState('teacher_set_pw'); 
      }
    } else if (userRole === 'student') {
      if (status === 'in_use') {
        setTargetRoom({ id: roomId, data: roomData });
        setModalState('enter_room_pw'); 
      } else {
        showAppDialog('알림', '현재 비어있는 방입니다.\n선생님이 개설한 방을 선택해주세요.');
      }
    }
  };

  const handleSetPassword = async () => {
    if (!roomPassword.trim()) { setAuthError('비밀번호를 입력해주세요.'); return; }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', targetRoom.id), {
        status: 'in_use',
        password: roomPassword,
        title: '',
        questions: [],
        mode: 'grading'
      });
      setSelectedRoom(targetRoom.id);
      setAppMode('dashboard');
      closeModal();
    } catch (e) {
      console.error(e);
      setAuthError('오류가 발생했습니다.');
    }
  };

  const handleEnterPassword = () => {
    if (roomPassword === targetRoom.data.password) {
      setSelectedRoom(targetRoom.id);
      setAppMode('dashboard');
      closeModal();
    } else {
      setAuthError('비밀번호가 일치하지 않습니다.');
    }
  };

  const closeModal = () => {
    setModalState('none');
    setRoomPassword('');
    setAuthError('');
    setTargetRoom(null);
  };

  if (appMode === 'home') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-indigo-100 rounded-full blur-[120px] opacity-50"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-emerald-100 rounded-full blur-[120px] opacity-50"></div>
        
        <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-[40px] shadow-2xl p-10 text-center z-10 border border-white">
          <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg transform rotate-3">
            <ClipboardCheck size={40} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">스마트 평가 시스템</h1>
          <p className="text-gray-500 mb-10 font-bold">진행할 역할을 선택해 주세요</p>
          
          <div className="space-y-4">
            <button onClick={() => { setUserRole('teacher'); setAppMode('room_select'); }} className="w-full flex items-center p-5 bg-white border-2 border-gray-50 rounded-3xl hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-100 transition-all group">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mr-4 group-hover:scale-110 transition-transform"><User size={28} /></div>
              <div className="text-left flex-1">
                <h3 className="font-black text-gray-800">교사 워크스페이스</h3>
                <p className="text-xs text-gray-400 font-bold">평가 출제 및 방 관리</p>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-indigo-500" />
            </button>

            <button onClick={() => { setUserRole('student'); setAppMode('room_select'); }} className="w-full flex items-center p-5 bg-white border-2 border-gray-50 rounded-3xl hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-100 transition-all group">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mr-4 group-hover:scale-110 transition-transform"><Users size={28} /></div>
              <div className="text-left flex-1">
                <h3 className="font-black text-gray-800">학생 평가 참여</h3>
                <p className="text-xs text-gray-400 font-bold">선생님 방 진입 및 제출</p>
              </div>
              <ChevronRight className="text-gray-300 group-hover:text-emerald-500" />
            </button>
          </div>
        </div>
        <div className="absolute bottom-6 text-xs text-gray-400 font-semibold tracking-wider z-10">
          제작자: 삼례동초 호근쌤 | Version 1.4.0
        </div>
      </div>
    );
  }

  if (appMode === 'dashboard') {
    if (userRole === 'teacher') {
      return <TeacherDashboard exam={roomExamData} submissions={submissions} selectedRoom={selectedRoom} goBack={() => setAppMode('room_select')} />;
    } else {
      return <StudentScreen exam={roomExamData} user={user} selectedRoom={selectedRoom} goBack={() => setAppMode('room_select')} />;
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
      <header className="max-w-6xl mx-auto w-full mb-8 flex items-center justify-between">
        <div>
          <button onClick={() => setAppMode('home')} className="flex items-center text-gray-500 hover:text-indigo-600 font-bold mb-4 bg-white px-4 py-2 rounded-xl shadow-sm transition-colors">
            <Home size={18} className="mr-2" /> 메인 홈으로
          </button>
          
          <h1 className="text-3xl font-black text-gray-800 flex items-center">
            {userRole === 'teacher' ? <User className="mr-3 text-indigo-600" size={32} /> : <Users className="mr-3 text-emerald-600" size={32} />}
            {userRole === 'teacher' ? '워크스페이스 선택' : '접속할 방 선택'}
          </h1>
          <p className="text-gray-500 mt-2 font-medium">
            {userRole === 'teacher' 
              ? '새로운 시험지를 생성하거나 개설한 시험지에 다시 진입하세요.' 
              : '선생님이 안내해주신 번호의 방 비밀번호를 입력하고 입장하세요.'}
          </p>
        </div>
      </header>

      {/* ⭐️ 30개로 늘어난 방 목록 UI 렌더링 영역 */}
      <main className="max-w-6xl mx-auto w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {[...Array(30)].map((_, i) => {
          const roomId = `room_${i + 1}`;
          const roomData = rooms[roomId] || { status: 'available' };
          const isInUse = roomData.status === 'in_use';

          return (
            <button 
              key={roomId}
              onClick={() => handleRoomClick(roomId, roomData)}
              className={`relative flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all group overflow-hidden ${
                isInUse 
                  ? 'bg-white border-indigo-100 hover:border-indigo-400 shadow-md hover:shadow-xl' 
                  : 'bg-transparent border-dashed border-gray-300 hover:bg-gray-100'
              }`}
            >
              {isInUse ? (
                <>
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Lock size={24} />
                  </div>
                  <h3 className="font-black text-xl text-gray-800">{i + 1}번 방</h3>
                  <div className="mt-2 bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-3 py-1 rounded-full flex items-center uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-1.5 animate-pulse"></span>
                    사용 중
                  </div>
                  {roomData.title && (
                    <p className="text-xs text-gray-500 mt-3 font-medium text-center line-clamp-1 w-full px-2">{roomData.title}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="w-14 h-14 bg-white/50 text-gray-400 rounded-2xl flex items-center justify-center mb-4 group-hover:text-emerald-500 group-hover:bg-emerald-50 transition-colors">
                    <Unlock size={24} />
                  </div>
                  <h3 className="font-black text-xl text-gray-400 group-hover:text-gray-800 transition-colors">{i + 1}번 방</h3>
                  <div className="mt-2 bg-gray-200 text-gray-500 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                    비어있음
                  </div>
                </>
              )}
            </button>
          );
        })}
      </main>

      {/* 방 진입/비밀번호 모달 */}
      {modalState !== 'none' && (
        <div className="fixed inset-0 bg-indigo-900/40 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[40px] shadow-2xl p-10 max-w-sm w-full relative animate-in zoom-in-95 duration-200">
            <button onClick={closeModal} className="absolute top-6 right-6 text-gray-300 hover:text-gray-500"><XCircle size={24} /></button>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${modalState === 'teacher_set_pw' ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'}`}>
              {modalState === 'teacher_set_pw' ? <Unlock size={28} /> : <Lock size={28} />}
            </div>
            
            <h2 className="text-2xl font-black text-center text-gray-800 mb-2">
              {targetRoom?.id.replace('room_', '')}번 방 {modalState === 'teacher_set_pw' ? '개설하기' : '진입하기'}
            </h2>
            <p className="text-center text-sm text-gray-400 font-bold mb-8 font-medium">
              {userRole === 'student' 
                ? '선생님이 안내해주신 방 비밀번호를 입력해주세요.' 
                : modalState === 'teacher_set_pw' 
                  ? '새로운 워크스페이스 전용 비밀번호를 설정하세요.' 
                  : '이 방을 개설할 때 설정한 비밀번호를 입력하세요.'}
            </p>
            
            <div className="relative mb-2">
              <Key size={20} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-300" />
              <input
                type="password"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (modalState === 'teacher_set_pw' ? handleSetPassword() : handleEnterPassword())}
                placeholder="비밀번호"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                autoFocus
              />
            </div>
            
            <div className="h-6 mb-4 flex items-center justify-center">
              {authError && <p className="text-red-500 text-sm font-bold animate-in fade-in">{authError}</p>}
            </div>

            <button
              onClick={modalState === 'teacher_set_pw' ? handleSetPassword : handleEnterPassword}
              className={`w-full py-4 text-white font-black rounded-2xl shadow-lg transition-all ${
                modalState === 'teacher_set_pw' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {modalState === 'teacher_set_pw' ? '비밀번호 설정 및 개설' : '방 진입'}
            </button>
          </div>
        </div>
      )}
      
      <CustomDialog dialog={appDialog} setDialog={setAppDialog} />
    </div>
  );
}