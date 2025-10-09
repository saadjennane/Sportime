import React, { useState } from "react";
import { Badge, LevelConfig } from "../types";
import { ArrowLeft, Edit, Plus, Trash2 } from "lucide-react";

// Props for the main component
interface ProgressionAdminProps {
  levels: LevelConfig[];
  badges: Badge[];
  onAddLevel: (level: Omit<LevelConfig, "id">) => void;
  onUpdateLevel: (level: LevelConfig) => void;
  onDeleteLevel: (levelId: string) => void;
  onAddBadge: (badge: Omit<Badge, "id" | "created_at">) => void;
  onUpdateBadge: (badge: Badge) => void;
  onDeleteBadge: (badgeId: string) => void;
}

// Type definitions for the view state
type View =
  | { type: "main" }
  | { type: "level-form"; level?: LevelConfig }
  | { type: "badge-form"; badge?: Badge };

// --- Level Form Component ---
interface LevelFormProps {
  level?: LevelConfig;
  onSubmit: (data: Omit<LevelConfig, "id"> | LevelConfig) => void;
  onCancel: () => void;
}

const LevelForm: React.FC<LevelFormProps> = ({ level, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    level_name: level?.level_name || "",
    min_xp: level?.min_xp || 0,
    max_xp: level?.max_xp || 0,
    level_icon_url: level?.level_icon_url || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name.includes("xp") ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (level) {
      onSubmit({ ...level, ...formData });
    } else {
      onSubmit(formData);
    }
  };

  const formField =
    "w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        name="level_name"
        value={formData.level_name}
        onChange={handleChange}
        placeholder="Level Name"
        className={formField}
        required
      />
      <input
        name="level_icon_url"
        value={formData.level_icon_url}
        onChange={handleChange}
        placeholder="Icon (Emoji or URL)"
        className={formField}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <input
          type="number"
          name="min_xp"
          value={formData.min_xp}
          onChange={handleChange}
          placeholder="Min XP"
          className={formField}
          required
        />
        <input
          type="number"
          name="max_xp"
          value={formData.max_xp}
          onChange={handleChange}
          placeholder="Max XP"
          className={formField}
          required
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold"
        >
          Save Level
        </button>
      </div>
    </form>
  );
};

// --- Badge Form Component ---
interface BadgeFormProps {
  badge?: Badge;
  onSubmit: (data: Omit<Badge, "id" | "created_at"> | Badge) => void;
  onCancel: () => void;
}

const BadgeForm: React.FC<BadgeFormProps> = ({ badge, onSubmit, onCancel }) => {
  const conditionTypes = [
    "correct_predictions",
    "high_odds",
    "streak",
    "early_participation",
    "loyalty",
    "risk_averse",
  ];
  const [conditionValueKey, setConditionValueKey] = useState(
    badge ? Object.keys(badge.condition_value)[0] || "count" : "count",
  );
  const [conditionValue, setConditionValue] = useState(
    badge
      ? badge.condition_value[Object.keys(badge.condition_value)[0]] || ""
      : "",
  );

  const [formData, setFormData] = useState({
    name: badge?.name || "",
    description: badge?.description || "",
    icon_url: badge?.icon_url || "",
    condition_type: badge?.condition_type || conditionTypes[0],
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalData = {
      ...formData,
      condition_value: {
        [conditionValueKey]: !isNaN(Number(conditionValue))
          ? Number(conditionValue)
          : conditionValue,
      },
    };
    if (badge) {
      onSubmit({ ...badge, ...finalData });
    } else {
      onSubmit(finalData);
    }
  };

  const formField =
    "w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        name="name"
        value={formData.name}
        onChange={handleChange}
        placeholder="Badge Name"
        className={formField}
        required
      />
      <input
        name="icon_url"
        value={formData.icon_url}
        onChange={handleChange}
        placeholder="Icon (Emoji or URL)"
        className={formField}
        required
      />
      <textarea
        name="description"
        value={formData.description}
        onChange={handleChange}
        placeholder="Description"
        className={`${formField} h-24`}
        required
      />
      <select
        name="condition_type"
        value={formData.condition_type}
        onChange={handleChange}
        className={formField}
      >
        {conditionTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={conditionValueKey}
          onChange={(e) => setConditionValueKey(e.target.value)}
          placeholder="Condition Key"
          className={formField}
        />
        <input
          value={conditionValue}
          onChange={(e) => setConditionValue(e.target.value)}
          placeholder="Condition Value"
          className={formField}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold"
        >
          Save Badge
        </button>
      </div>
    </form>
  );
};

// --- Main Admin Component ---
export const ProgressionAdmin: React.FC<ProgressionAdminProps> = (props) => {
  const [view, setView] = useState<View>({ type: "main" });

  const renderMainView = () => (
    <div className="space-y-6">
      {/* Levels Section */}
      <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-gray-800">Manage Levels</h3>
          <button
            onClick={() => setView({ type: "level-form" })}
            className="flex items-center gap-2 text-sm font-semibold bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200"
          >
            <Plus /> Add New
          </button>
        </div>
        <div className="space-y-2">
          {props.levels.map((level) => (
            <div
              key={level.id}
              className="flex items-center bg-gray-50 p-3 rounded-lg"
            >
              <span className="text-xl mr-3">{level.level_icon_url}</span>
              <div className="flex-1">
                <p className="font-semibold">{level.level_name}</p>
                <p className="text-xs text-gray-500">
                  XP: {level.min_xp} - {level.max_xp}
                </p>
              </div>
              <button
                onClick={() => setView({ type: "level-form", level })}
                className="p-2 hover:bg-gray-200 rounded-full"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => props.onDeleteLevel(level.id)}
                className="p-2 hover:bg-red-100 rounded-full text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Badges Section */}
      <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg text-gray-800">Manage Badges</h3>
          <button
            onClick={() => setView({ type: "badge-form" })}
            className="flex items-center gap-2 text-sm font-semibold bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200"
          >
            <Plus /> Add New
          </button>
        </div>
        <div className="space-y-2">
          {props.badges.map((badge) => (
            <div
              key={badge.id}
              className="flex items-center bg-gray-50 p-3 rounded-lg"
            >
              <span className="text-2xl mr-4">{badge.icon_url}</span>
              <div className="flex-1">
                <p className="font-semibold">{badge.name}</p>
                <p className="text-xs text-gray-500">{badge.description}</p>
              </div>
              <button
                onClick={() => setView({ type: "badge-form", badge })}
                className="p-2 hover:bg-gray-200 rounded-full"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => props.onDeleteBadge(badge.id)}
                className="p-2 hover:bg-red-100 rounded-full text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFormView = () => {
    if (view.type === "main") return null;
    const isLevel = view.type === "level-form";
    const title = `${isLevel ? (view.level ? "Edit" : "Add") : view.badge ? "Edit" : "Add"} ${isLevel ? "Level" : "Badge"}`;

    return (
      <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView({ type: "main" })}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowLeft />
          </button>
          <h3 className="font-bold text-lg text-gray-800">{title}</h3>
        </div>
        {isLevel ? (
          <LevelForm
            level={view.level}
            onSubmit={(data) => {
              if ("id" in data) props.onUpdateLevel(data as LevelConfig);
              else props.onAddLevel(data as Omit<LevelConfig, "id">);
              setView({ type: "main" });
            }}
            onCancel={() => setView({ type: "main" })}
          />
        ) : (
          <BadgeForm
            badge={view.badge}
            onSubmit={(data) => {
              if ("id" in data) props.onUpdateBadge(data as Badge);
              else props.onAddBadge(data as Omit<Badge, "id" | "created_at">);
              setView({ type: "main" });
            }}
            onCancel={() => setView({ type: "main" })}
          />
        )}
      </div>
    );
  };

  return view.type === "main" ? renderMainView() : renderFormView();
};
