import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Mail,
  MessageSquare,
  Smartphone,
  AlertTriangle,
  Activity,
} from "lucide-react";

const MessageQueueSimulator = () => {
  const [queues, setQueues] = useState({ email: [], inApp: [], push: [] });
  const [dlq, setDlq] = useState([]);
  const [workers, setWorkers] = useState({
    email: { active: false, processing: null },
    inApp: { active: false, processing: null },
    push: { active: false, processing: null },
  });
  const [logs, setLogs] = useState<
    Array<{ message: string; type: string; timestamp: string }>
  >([]);
  const [stats, setStats] = useState({ processed: 0, failed: 0, retried: 0 });
  const intervalRefs = useRef({});

  const addLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-9), { message, type, timestamp }]);
  };

  const generateMessage = (type, endpoint) => ({
    id: Math.random().toString(36).substr(2, 9),
    type,
    endpoint,
    timestamp: Date.now(),
    retryCount: 0,
    status: "queued",
  });

  const sendMessage = (type, endpoint) => {
    const message = generateMessage(type, endpoint);
    setQueues((prev) => ({ ...prev, [type]: [...prev[type], message] }));
    addLog(`Message queued: ${endpoint}`, "success");
  };

  const processMessage = (queueType) => {
    setQueues((prev) => {
      if (prev[queueType].length === 0) return prev;
      const [message, ...rest] = prev[queueType];

      setWorkers((prevWorkers) => ({
        ...prevWorkers,
        [queueType]: { active: true, processing: message },
      }));

      setTimeout(() => {
        const success = Math.random() > 0.2;
        if (success) {
          setStats((s) => ({ ...s, processed: s.processed + 1 }));
          addLog(`${queueType} message processed: ${message.id}`, "success");
        } else {
          if (message.retryCount < 3) {
            const retryMessage = {
              ...message,
              retryCount: message.retryCount + 1,
              status: "retrying",
            };
            setQueues((q) => ({
              ...q,
              [queueType]: [...q[queueType], retryMessage],
            }));
            setStats((s) => ({ ...s, retried: s.retried + 1 }));
            addLog(`Retrying message: ${message.id}`, "warning");
          } else {
            setDlq((d) => [...d, { ...message, status: "failed" }]);
            setStats((s) => ({ ...s, failed: s.failed + 1 }));
            addLog(`Message sent to DLQ: ${message.id}`, "error");
          }
        }
        setWorkers((prevWorkers) => ({
          ...prevWorkers,
          [queueType]: { active: false, processing: null },
        }));
      }, 2000);

      return { ...prev, [queueType]: rest };
    });
  };

  useEffect(() => {
    ["email", "inApp", "push"].forEach((queueType) => {
      intervalRefs.current[queueType] = setInterval(() => {
        if (!workers[queueType].active && queues[queueType].length > 0) {
          processMessage(queueType);
        }
      }, 1000);
    });
    return () => {
      Object.values(intervalRefs.current).forEach((i) => clearInterval(i));
    };
  }, [workers, queues]);

  const queueConfigs = {
    email: {
      icon: Mail,
      endpoint: "POST /login",
      description: "Authentication emails",
    },
    inApp: {
      icon: MessageSquare,
      endpoint: "POST /post",
      description: "In-app notifications",
    },
    push: {
      icon: Smartphone,
      endpoint: "POST /friend-req",
      description: "Push notifications",
    },
  };

  const getLogIcon = (type) => {
    switch (type) {
      case "success":
        return "✔️";
      case "warning":
        return "⚠️";
      case "error":
        return "❌";
      default:
        return "ℹ️";
    }
  };

  return (
    <div className="p-8 font-sans text-gray-900 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Message Queue Simulator
      </h1>

      {/* API Triggers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {Object.entries(queueConfigs).map(([type, config]) => {
          const Icon = config.icon;
          return (
            <div key={type} className="bg-white border rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5 text-gray-600" />
                <div className="font-semibold capitalize">{type}</div>
              </div>
              <p className="text-xs mb-3 text-gray-500">{config.description}</p>
              <button
                onClick={() => sendMessage(type, config.endpoint)}
                className="bg-gray-800 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
              >
                Trigger {config.endpoint}
              </button>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Processed", value: stats.processed },
          { label: "Retried", value: stats.retried },
          { label: "Failed", value: stats.failed },
          { label: "DLQ", value: dlq.length },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white border rounded-lg shadow p-4 text-center"
          >
            <div className="font-semibold">{stat.label}</div>
            <div className="text-lg">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Queues */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {Object.entries(queueConfigs).map(([queueType, config]) => {
          const Icon = config.icon;
          const isActive = workers[queueType].active;
          return (
            <div
              key={queueType}
              className="bg-white border rounded-lg shadow p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5 text-gray-600" />
                <div className="font-semibold capitalize">
                  {queueType} Queue
                </div>
              </div>
              <div className="text-sm">Queued: {queues[queueType].length}</div>
              <div className="text-sm mb-1">
                Status:{" "}
                <span className={isActive ? "text-blue-600" : "text-gray-600"}>
                  {isActive ? "Processing" : "Idle"}
                </span>
              </div>
              {workers[queueType].processing && (
                <div className="text-xs text-gray-500">
                  Processing: {workers[queueType].processing.id}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* DLQ */}
      <div className="bg-white border rounded-lg shadow p-4 mb-8">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-gray-600" />
          <div className="font-semibold">Dead Letter Queue</div>
        </div>
        {dlq.length === 0 ? (
          <div className="text-sm text-gray-500">No failed messages</div>
        ) : (
          dlq.map((msg) => (
            <div key={msg.id} className="text-xs border-b py-1">
              {msg.id} – {msg.endpoint}
            </div>
          ))
        )}
      </div>

      {/* Logs */}
      <div className="bg-white border rounded-lg shadow p-4 mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-gray-600" />
          <div className="font-semibold">Activity Log</div>
        </div>
        <div className="h-40 overflow-y-auto text-xs space-y-1 bg-gray-50 p-2 rounded">
          {logs.length === 0 && (
            <div className="text-gray-500">No activity yet</div>
          )}
          {logs.map((log, i) => (
            <div key={i} className="flex items-center gap-1">
              {getLogIcon(log.type)} {log.message} ({log.timestamp})
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => {
            for (let i = 0; i < 5; i++) {
              setTimeout(() => {
                const types = ["email", "inApp", "push"];
                const randomType =
                  types[Math.floor(Math.random() * types.length)];
                const config = queueConfigs[randomType];
                sendMessage(randomType, config.endpoint);
              }, i * 200);
            }
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500 text-sm"
        >
          Load Test (5 msgs)
        </button>
        <button
          onClick={() => {
            setQueues({ email: [], inApp: [], push: [] });
            setDlq([]);
            setLogs([]);
            setStats({ processed: 0, failed: 0, retried: 0 });
            addLog("System reset completed", "info");
          }}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-500 text-sm"
        >
          Reset System
        </button>
      </div>
    </div>
  );
};

export default MessageQueueSimulator;
