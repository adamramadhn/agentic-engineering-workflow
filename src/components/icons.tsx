import { forwardRef } from "react";
import { HugeiconsIcon, type HugeiconsIconProps, type IconSvgElement } from "@hugeicons/react";
import {
  AlertCircleIcon as AlertCircleIconData,
  AlertTriangle as AlertTriangleData,
  ArrowDownIcon as ArrowDownIconData,
  ArrowLeftIcon as ArrowLeftIconData,
  ArrowRightIcon as ArrowRightIconData,
  ArrowUpIcon as ArrowUpIconData,
  ArrowUpRight01Icon as ArrowUpRight01IconData,
  Attachment01Icon as Attachment01IconData,
  BellIcon as BellIconData,
  Book01Icon as Book01IconData,
  DashboardSquareIcon as BoardIconData,
  BotIcon as BotIconData,
  BuildingIcon as BuildingIconData,
  Cancel01Icon as Cancel01IconData,
  Calendar03Icon as Calendar03IconData,
  CheckCheckIcon as CheckCheckIconData,
  CheckIcon as CheckIconData,
  CheckmarkCircle02Icon as CheckmarkCircle02IconData,
  ChevronDownIcon as ChevronDownIconData,
  ChevronLeftIcon as ChevronLeftIconData,
  ChevronRightIcon as ChevronRightIconData,
  ChevronUpIcon as ChevronUpIconData,
  CircleCheckIcon as CircleCheckIconData,
  ClapperboardIcon as ClapperboardIconData,
  ClipboardIcon as ClipboardIconData,
  Clock01Icon as Clock01IconData,
  CloudUploadIcon as CloudUploadIconData,
  Comment02Icon as Comment02IconData,
  CopyIcon as CopyIconData,
  CreditCardIcon as CreditCardIconData,
  DatabaseIcon as DatabaseIconData,
  DollarSignIcon as DollarSignIconData,
  DownloadIcon as DownloadIconData,
  Edit02Icon as EditIconData,
  ExternalLinkIcon as ExternalLinkIconData,
  EyeIcon as EyeIconData,
  EyeOffIcon as EyeOffIconData,
  FileQuestionMarkIcon as FileQuestionMarkIconData,
  File01Icon as File01IconData,
  FilterIcon as FilterIconData,
  FloppyDiskIcon as FloppyDiskIconData,
  Folder01Icon as Folder01IconData,
  GitBranchIcon as GitBranchIconData,
  GlobeIcon as GlobeIconData,
  Home01Icon as Home01IconData,
  HomeIcon as HomeIconData,
  Image01Icon as Image01IconData,
  InfoIcon as InfoIconData,
  KeyRoundIcon as KeyRoundIconData,
  KanbanIcon as KanbanIconData,
  LaptopIcon as LaptopIconData,
  Layers01Icon as Layers01IconData,
  LayersIcon as LayersIconData,
  LayoutIcon as LayoutIconData,
  LineChart as LineChartData,
  Link01Icon as Link01IconData,
  Link02Icon as Link02IconData,
  ListIcon as ListIconData,
  Loading03Icon as Loading03IconData,
  LockIcon as LockIconData,
  LogOutIcon as LogOutIconData,
  MagicWand01Icon as MagicWand01IconData,
  MailIcon as MailIconData,
  MessageSquareIcon as MessageSquareIconData,
  MinusIcon as MinusIconData,
  MoonIcon as MoonIconData,
  MoreHorizontalIcon as MoreHorizontalIconData,
  Note02Icon as Note02IconData,
  Notification01Icon as Notification01IconData,
  OctagonXIcon as OctagonXIconData,
  PanelLeftIcon as PanelLeftIconData,
  PieChartIcon as PieChartIconData,
  PlayIcon as PlayIconData,
  PlugSocketIcon as PlugSocketIconData,
  PlusIcon as PlusIconData,
  RefreshCwIcon as RefreshCwIconData,
  RotateCcwIcon as RotateCcwIconData,
  SearchIcon as SearchIconData,
  SendIcon as SendIconData,
  Settings01Icon as Settings01IconData,
  SourceCodeIcon as SourceCodeIconData,
  SettingsIcon as SettingsIconData,
  ShoppingBagIcon as ShoppingBagIconData,
  SlidersHorizontalIcon as SlidersHorizontalIconData,
  SparklesIcon as SparklesIconData,
  SunIcon as SunIconData,
  Tag01Icon as Tag01IconData,
  TerminalIcon as TerminalIconData,
  TextBoldIcon as TextBoldIconData,
  TextItalicIcon as TextItalicIconData,
  TextIcon as TextIconData,
  Trash2 as Trash2Data,
  TrendingUpIcon as TrendingUpIconData,
  TriangleAlertIcon as TriangleAlertIconData,
  Upload04Icon as Upload04IconData,
  UserCheckIcon as UserCheckIconData,
  UserGroupIcon as UserGroupIconData,
  UserIcon as UserIconData,
  UsersIcon as UsersIconData,
  Wrench01Icon as Wrench01IconData,
  XIcon as XIconData,
  ZapIcon as ZapIconData,
} from "@hugeicons/core-free-icons";

export type IconProps = Omit<HugeiconsIconProps, "icon">;
export type IconComponent = ReturnType<typeof createIcon>;

function createIcon(name: string, icon: IconSvgElement) {
  const Icon = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <HugeiconsIcon ref={ref} icon={icon} size={24} strokeWidth={1.5} aria-hidden="true" {...props} />
  ));
  Icon.displayName = name;
  return Icon;
}

export const AlertCircle = createIcon("AlertCircle", AlertCircleIconData);
export const AlertTriangle = createIcon("AlertTriangle", AlertTriangleData);
export const ArrowDown = createIcon("ArrowDown", ArrowDownIconData);
export const ArrowLeft = createIcon("ArrowLeft", ArrowLeftIconData);
export const ArrowRight = createIcon("ArrowRight", ArrowRightIconData);
export const ArrowUp = createIcon("ArrowUp", ArrowUpIconData);
export const Paperclip = createIcon("Paperclip", Attachment01IconData);
export const Bell = createIcon("Bell", BellIconData);
export const WikiIcon = createIcon("WikiIcon", Book01IconData);
export const Board = createIcon("Board", BoardIconData);
export const Layout = createIcon("Layout", LayoutIconData);
export const Kanban = createIcon("Kanban", KanbanIconData);
export const Bot = createIcon("Bot", BotIconData);
export const Building = createIcon("Building", BuildingIconData);
export const CancelIcon = createIcon("CancelIcon", Cancel01IconData);
export const Check = createIcon("Check", CheckIconData);
export const CheckCheck = createIcon("CheckCheck", CheckCheckIconData);
export const CheckCircle2 = createIcon("CheckCircle2", CheckmarkCircle02IconData);
export const CheckIcon = createIcon("CheckIcon", CheckIconData);
export const ChevronDown = createIcon("ChevronDown", ChevronDownIconData);
export const ChevronDownIcon = createIcon("ChevronDownIcon", ChevronDownIconData);
export const ChevronLeft = createIcon("ChevronLeft", ChevronLeftIconData);
export const ChevronRight = createIcon("ChevronRight", ChevronRightIconData);
export const ChevronRightIcon = createIcon("ChevronRightIcon", ChevronRightIconData);
export const ChevronUp = createIcon("ChevronUp", ChevronUpIconData);
export const ChevronUpIcon = createIcon("ChevronUpIcon", ChevronUpIconData);
export const CircleCheck = createIcon("CircleCheck", CircleCheckIconData);
export const CircleCheckIcon = createIcon("CircleCheckIcon", CircleCheckIconData);
export const Clapperboard = createIcon("Clapperboard", ClapperboardIconData);
export const Copy = createIcon("Copy", CopyIconData);
export const CreditCard = createIcon("CreditCard", CreditCardIconData);
export const Database = createIcon("Database", DatabaseIconData);
export const DollarSign = createIcon("DollarSign", DollarSignIconData);
export const Download = createIcon("Download", DownloadIconData);
export const EditIcon = createIcon("EditIcon", EditIconData);
export const ExternalLink = createIcon("ExternalLink", ExternalLinkIconData);
export const Eye = createIcon("Eye", EyeIconData);
export const EyeOff = createIcon("EyeOff", EyeOffIconData);
export const FileQuestion = createIcon("FileQuestion", FileQuestionMarkIconData);
export const FileDoc = createIcon("FileDoc", File01IconData);
export const Filter = createIcon("Filter", FilterIconData);
export const Folder = createIcon("Folder", Folder01IconData);
export const SaveIcon = createIcon("SaveIcon", FloppyDiskIconData);
export const GitBranch = createIcon("GitBranch", GitBranchIconData);
export const Globe = createIcon("Globe", GlobeIconData);
export const Home = createIcon("Home", HomeIconData);
export const ImageIcon = createIcon("ImageIcon", Image01IconData);
export const Info = createIcon("Info", InfoIconData);
export const InfoIcon = createIcon("InfoIcon", InfoIconData);
export const KeyRound = createIcon("KeyRound", KeyRoundIconData);
export const Laptop = createIcon("Laptop", LaptopIconData);
export const Layers = createIcon("Layers", LayersIconData);
export const LineChart = createIcon("LineChart", LineChartData);
export const Loader2 = createIcon("Loader2", Loading03IconData);
export const Loader2Icon = createIcon("Loader2Icon", Loading03IconData);
export const Lock = createIcon("Lock", LockIconData);
export const LogOut = createIcon("LogOut", LogOutIconData);
export const Mail = createIcon("Mail", MailIconData);
export const MessageSquare = createIcon("MessageSquare", MessageSquareIconData);
export const Minus = createIcon("Minus", MinusIconData);
export const Moon = createIcon("Moon", MoonIconData);
export const MoreHorizontal = createIcon("MoreHorizontal", MoreHorizontalIconData);
export const MoreHorizontalIcon = createIcon("MoreHorizontalIcon", MoreHorizontalIconData);
export const Note = createIcon("Note", Note02IconData);
export const OctagonXIcon = createIcon("OctagonXIcon", OctagonXIconData);
export const PanelLeft = createIcon("PanelLeft", PanelLeftIconData);
export const PanelLeftIcon = createIcon("PanelLeftIcon", PanelLeftIconData);
export const Play = createIcon("Play", PlayIconData);
export const Plus = createIcon("Plus", PlusIconData);
export const RefreshCw = createIcon("RefreshCw", RefreshCwIconData);
export const RotateCcw = createIcon("RotateCcw", RotateCcwIconData);
export const Search = createIcon("Search", SearchIconData);
export const SearchIcon = createIcon("SearchIcon", SearchIconData);
export const Send = createIcon("Send", SendIconData);
export const CodeIcon = createIcon("CodeIcon", SourceCodeIconData);
export const Settings = createIcon("Settings", SettingsIconData);
export const ShoppingBag = createIcon("ShoppingBag", ShoppingBagIconData);
export const Sliders = createIcon("Sliders", SlidersHorizontalIconData);
export const SlidersHorizontal = createIcon("SlidersHorizontal", SlidersHorizontalIconData);
export const Sparkles = createIcon("Sparkles", SparklesIconData);
export const Sun = createIcon("Sun", SunIconData);
export const TagIcon = createIcon("TagIcon", Tag01IconData);
export const Terminal = createIcon("Terminal", TerminalIconData);
export const Text = createIcon("Text", TextIconData);
export const BoldIcon = createIcon("BoldIcon", TextBoldIconData);
export const ItalicIcon = createIcon("ItalicIcon", TextItalicIconData);
export const Trash2 = createIcon("Trash2", Trash2Data);
export const TrendingUp = createIcon("TrendingUp", TrendingUpIconData);
export const TriangleAlert = createIcon("TriangleAlert", TriangleAlertIconData);
export const UploadIcon = createIcon("UploadIcon", Upload04IconData);
export const TriangleAlertIcon = createIcon("TriangleAlertIcon", TriangleAlertIconData);
export const User = createIcon("User", UserIconData);
export const UserCheck = createIcon("UserCheck", UserCheckIconData);
export const Users = createIcon("Users", UsersIconData);
export const Wrench = createIcon("Wrench", Wrench01IconData);
export const Wand2 = createIcon("Wand2", MagicWand01IconData);
export const X = createIcon("X", XIconData);
export const XIcon = createIcon("XIcon", XIconData);
export const Zap = createIcon("Zap", ZapIconData);
export const ArrowUpRight = createIcon("ArrowUpRight", ArrowUpRight01IconData);
export const Clock = createIcon("Clock", Clock01IconData);
export const CloudUpload = createIcon("CloudUpload", CloudUploadIconData);
export const CommentIcon = createIcon("CommentIcon", Comment02IconData);
export const Calendar = createIcon("Calendar", Calendar03IconData);
export const Link = createIcon("Link", Link01IconData);
export const Link02 = createIcon("Link02", Link02IconData);
export const ListIcon = createIcon("ListIcon", ListIconData);
export const ConnectIcon = createIcon("ConnectIcon", PlugSocketIconData);
export const HomeIcon = createIcon("HomeIcon", Home01IconData);
export const MetricsIcon = createIcon("MetricsIcon", PieChartIconData);
export const ReportsIcon = createIcon("ReportsIcon", ClipboardIconData);
export const AlertsIcon = createIcon("AlertsIcon", Notification01IconData);
export const SettingsIcon = createIcon("SettingsIcon", Settings01IconData);
export const CustomersIcon = createIcon("CustomersIcon", UserGroupIconData);
export const ComponentsIcon = createIcon("ComponentsIcon", Layers01IconData);
