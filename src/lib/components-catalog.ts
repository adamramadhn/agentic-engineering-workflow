export interface ComponentPropDoc {
  name: string;
  type: string;
  default?: string;
  description: string;
}

export interface ComponentMeta {
  slug: string;
  title: string;
  category: "primitives" | "forms" | "overlays" | "data-display" | "feedback";
  categoryLabel: string;
  description: string;
  cli: string;
  importPath: string;
  propsDoc: ComponentPropDoc[];
}

export const COMPONENT_CATEGORIES = [
  { id: "primitives", label: "Primitives & Actions" },
  { id: "forms", label: "Form Controls" },
  { id: "overlays", label: "Overlays & Dialogs" },
  { id: "data-display", label: "Data Display & Layout" },
  { id: "feedback", label: "Feedback & Alerts" },
] as const;

export const COMPONENTS_CATALOG: ComponentMeta[] = [
  // 1. Button
  {
    slug: "button",
    title: "Button",
    category: "primitives",
    categoryLabel: "Primitives & Actions",
    description:
      "Tactile clickable element used to trigger actions, submit forms, and toggle states with active micro-scale feedback.",
    cli: "npx shadcn@latest add button",
    importPath: 'import { Button } from "@/components/ui/button"',
    propsDoc: [
      { name: "variant", type: '"default" | "destructive" | "outline" | "secondary" | "ghost" | "link"', default: '"default"', description: "The visual style applied to the button." },
      { name: "size", type: '"default" | "sm" | "lg" | "icon"', default: '"default"', description: "Controls height, padding, and font size." },
      { name: "asChild", type: "boolean", default: "false", description: "Merges props onto immediate child element." },
      { name: "disabled", type: "boolean", default: "false", description: "Disables pointer events and lowers opacity." },
    ],
  },
  // 2. Badge
  {
    slug: "badge",
    title: "Badge",
    category: "primitives",
    categoryLabel: "Primitives & Actions",
    description:
      "Compact label used to display statuses, counts, tags, or keyboard shortcut combinations.",
    cli: "npx shadcn@latest add badge",
    importPath: 'import { Badge } from "@/components/ui/badge"',
    propsDoc: [
      { name: "variant", type: '"default" | "secondary" | "destructive" | "outline"', default: '"default"', description: "Background and border tone of the badge." },
      { name: "className", type: "string", description: "Custom Tailwind CSS classes." },
    ],
  },
  // 3. Avatar
  {
    slug: "avatar",
    title: "Avatar",
    category: "primitives",
    categoryLabel: "Primitives & Actions",
    description:
      "Visual profile representation for users or entities with automatic initials fallback.",
    cli: "npx shadcn@latest add avatar",
    importPath: 'import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"',
    propsDoc: [
      { name: "src", type: "string", description: "URL source of the image provided to AvatarImage." },
      { name: "alt", type: "string", description: "Accessible description for screen readers." },
      { name: "className", type: "string", description: "Custom classes to adjust size (e.g. size-8)." },
    ],
  },
  // 4. Input
  {
    slug: "input",
    title: "Input",
    category: "forms",
    categoryLabel: "Form Controls",
    description:
      "Single-line text input field supporting search icons, email validation, disabled states, and focus rings.",
    cli: "npx shadcn@latest add input",
    importPath: 'import { Input } from "@/components/ui/input"',
    propsDoc: [
      { name: "type", type: "string", default: '"text"', description: "Native input type (text, email, password, etc.)." },
      { name: "placeholder", type: "string", description: "Hint displayed when value is empty." },
      { name: "disabled", type: "boolean", default: "false", description: "Prevents user interaction." },
      { name: "error", type: "boolean", default: "false", description: "Renders red destructive focus border." },
    ],
  },
  // 5. Textarea
  {
    slug: "textarea",
    title: "Textarea",
    category: "forms",
    categoryLabel: "Form Controls",
    description:
      "Multi-line plain text editing control with support for dynamic height and character limit indicators.",
    cli: "npx shadcn@latest add textarea",
    importPath: 'import { Textarea } from "@/components/ui/textarea"',
    propsDoc: [
      { name: "rows", type: "number", default: "3", description: "Initial visible line count." },
      { name: "maxLength", type: "number", description: "Maximum permitted character length." },
      { name: "placeholder", type: "string", description: "Guidance placeholder string." },
    ],
  },
  // 6. Select
  {
    slug: "select",
    title: "Select",
    category: "forms",
    categoryLabel: "Form Controls",
    description:
      "Accessible dropdown menu allowing users to select an option from a customizable floating list.",
    cli: "npx shadcn@latest add select",
    importPath: 'import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"',
    propsDoc: [
      { name: "value", type: "string", description: "Controlled value of selected item." },
      { name: "onValueChange", type: "(val: string) => void", description: "Callback when value changes." },
      { name: "disabled", type: "boolean", default: "false", description: "Disables trigger interactions." },
    ],
  },
  // 7. Switch
  {
    slug: "switch",
    title: "Switch",
    category: "forms",
    categoryLabel: "Form Controls",
    description:
      "Toggle control representing a binary checked or unchecked setting with smooth sliding thumb.",
    cli: "npx shadcn@latest add switch",
    importPath: 'import { Switch } from "@/components/ui/switch"',
    propsDoc: [
      { name: "checked", type: "boolean", description: "Controlled state of the switch." },
      { name: "onCheckedChange", type: "(checked: boolean) => void", description: "Event handler on toggle." },
      { name: "size", type: '"default" | "sm"', default: '"default"', description: "Physical dimensions of the pill." },
    ],
  },
  // 8. Checkbox
  {
    slug: "checkbox",
    title: "Checkbox",
    category: "forms",
    categoryLabel: "Form Controls",
    description:
      "Square toggle box for selecting multiple independent values or agreeing to terms.",
    cli: "npx shadcn@latest add checkbox",
    importPath: 'import { Checkbox } from "@/components/ui/checkbox"',
    propsDoc: [
      { name: "checked", type: 'boolean | "indeterminate"', description: "Controlled checkbox state." },
      { name: "onCheckedChange", type: "(checked: boolean) => void", description: "Change callback." },
      { name: "disabled", type: "boolean", default: "false", description: "Locks checkbox state." },
    ],
  },
  // 9. Dialog
  {
    slug: "dialog",
    title: "Dialog",
    category: "overlays",
    categoryLabel: "Overlays & Dialogs",
    description:
      "Modal window overlay interrupting workflow to demand confirmation, review, or input.",
    cli: "npx shadcn@latest add dialog",
    importPath: 'import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"',
    propsDoc: [
      { name: "open", type: "boolean", description: "Controlled open state." },
      { name: "onOpenChange", type: "(open: boolean) => void", description: "Event handler on open/close." },
    ],
  },
  // 10. Sheet
  {
    slug: "sheet",
    title: "Sheet",
    category: "overlays",
    categoryLabel: "Overlays & Dialogs",
    description:
      "Slide-over drawer that surfaces contextual panels from the edge of the viewport.",
    cli: "npx shadcn@latest add sheet",
    importPath: 'import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"',
    propsDoc: [
      { name: "side", type: '"top" | "right" | "bottom" | "left"', default: '"right"', description: "Edge from which drawer animates." },
    ],
  },
  // 11. Dropdown Menu
  {
    slug: "dropdown-menu",
    title: "Dropdown Menu",
    category: "overlays",
    categoryLabel: "Overlays & Dialogs",
    description:
      "Contextual floating action menu triggered by buttons, supporting icons and shortcut hints.",
    cli: "npx shadcn@latest add dropdown-menu",
    importPath: 'import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"',
    propsDoc: [
      { name: "open", type: "boolean", description: "Controls visibility." },
      { name: "onOpenChange", type: "(open: boolean) => void", description: "Open status handler." },
    ],
  },
  // 12. Popover
  {
    slug: "popover",
    title: "Popover",
    category: "overlays",
    categoryLabel: "Overlays & Dialogs",
    description:
      "Floating non-modal container for rich content, inline forms, or nested pickers.",
    cli: "npx shadcn@latest add popover",
    importPath: 'import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"',
    propsDoc: [
      { name: "side", type: '"top" | "right" | "bottom" | "left"', default: '"bottom"', description: "Anchor positioning." },
      { name: "align", type: '"start" | "center" | "end"', default: '"center"', description: "Alignment with trigger." },
    ],
  },
  // 13. Tooltip
  {
    slug: "tooltip",
    title: "Tooltip",
    category: "overlays",
    categoryLabel: "Overlays & Dialogs",
    description:
      "Micro hover callout displaying contextual descriptions or shortcuts for icon buttons.",
    cli: "npx shadcn@latest add tooltip",
    importPath: 'import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"',
    propsDoc: [
      { name: "delay", type: "number", default: "0", description: "Delay in ms before tooltip triggers." },
      { name: "side", type: '"top" | "right" | "bottom" | "left"', default: '"top"', description: "Tooltip side orientation." },
    ],
  },
  // 14. Card
  {
    slug: "card",
    title: "Card",
    category: "data-display",
    categoryLabel: "Data Display & Layout",
    description:
      "Bordered container used to group related information, KPI metrics, and actions into structured surfaces.",
    cli: "npx shadcn@latest add card",
    importPath: 'import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"',
    propsDoc: [
      { name: "className", type: "string", description: "Custom classes for container padding and borders." },
    ],
  },
  // 15. Table
  {
    slug: "table",
    title: "Table",
    category: "data-display",
    categoryLabel: "Data Display & Layout",
    description:
      "High-density tabular grid displaying rows and columns of structured dataset records.",
    cli: "npx shadcn@latest add table",
    importPath: 'import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"',
    propsDoc: [
      { name: "className", type: "string", description: "Table wrapper and element styling." },
    ],
  },
  // 16. Tabs
  {
    slug: "tabs",
    title: "Tabs",
    category: "data-display",
    categoryLabel: "Data Display & Layout",
    description:
      "Segmented tab switcher alternating between multiple panels within the same view canvas.",
    cli: "npx shadcn@latest add tabs",
    importPath: 'import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"',
    propsDoc: [
      { name: "defaultValue", type: "string", description: "Initial active tab identifier." },
      { name: "value", type: "string", description: "Controlled active tab key." },
      { name: "onValueChange", type: "(val: string) => void", description: "Tab switch handler." },
    ],
  },
  // 17. Skeleton
  {
    slug: "skeleton",
    title: "Skeleton",
    category: "data-display",
    categoryLabel: "Data Display & Layout",
    description:
      "Subtle animated placeholder frames rendered while content is being fetched asynchronously.",
    cli: "npx shadcn@latest add skeleton",
    importPath: 'import { Skeleton } from "@/components/ui/skeleton"',
    propsDoc: [
      { name: "className", type: "string", description: "Height and width utilities (e.g. h-4 w-full)." },
    ],
  },
  // 18. Breadcrumb
  {
    slug: "breadcrumb",
    title: "Breadcrumb",
    category: "data-display",
    categoryLabel: "Data Display & Layout",
    description:
      "Hierarchical trail indicating current navigation depth and parent route relationships.",
    cli: "npx shadcn@latest add breadcrumb",
    importPath: 'import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"',
    propsDoc: [
      { name: "separator", type: "ReactNode", description: "Custom divider icon between items." },
    ],
  },
  // 19. Collapsible
  {
    slug: "collapsible",
    title: "Collapsible",
    category: "data-display",
    categoryLabel: "Data Display & Layout",
    description:
      "Interactive expandable disclosure section for progressive content discovery and sub-menus.",
    cli: "npx shadcn@latest add collapsible",
    importPath: 'import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"',
    propsDoc: [
      { name: "open", type: "boolean", description: "Controlled expanded state." },
      { name: "onOpenChange", type: "(open: boolean) => void", description: "Toggle handler." },
    ],
  },
  // 20. Alert
  {
    slug: "alert",
    title: "Alert",
    category: "feedback",
    categoryLabel: "Feedback & Alerts",
    description:
      "Static prominent banner communicating critical system states, warnings, or guidance.",
    cli: "npx shadcn@latest add alert",
    importPath: 'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"',
    propsDoc: [
      { name: "variant", type: '"default" | "info" | "success" | "warning" | "destructive"', default: '"default"', description: "Semantic coloring and icon style." },
    ],
  },
  // 21. Sonner (Toast)
  {
    slug: "sonner",
    title: "Sonner (Toast)",
    category: "feedback",
    categoryLabel: "Feedback & Alerts",
    description:
      "Non-intrusive floating snackbar notification toasts triggered imperatively with sonner.",
    cli: "npx shadcn@latest add sonner",
    importPath: 'import { toast } from "sonner"',
    propsDoc: [
      { name: "message", type: "string | ReactNode", description: "Primary alert title." },
      { name: "options.description", type: "string", description: "Secondary explanatory copy." },
      { name: "options.action", type: "{ label: string, onClick: () => void }", description: "Optional action button." },
    ],
  },
];

export function getComponentBySlug(slug: string): ComponentMeta | undefined {
  return COMPONENTS_CATALOG.find((c) => c.slug === slug);
}
