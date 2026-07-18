import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  subscribeNotifications,
  markNotificationRead,
  type NotificationRecord,
} from "@/lib/firebaseNotifications";

const NotificationsBell = ({ userUid }: { userUid: string }) => {
  const [items, setItems] = useState<NotificationRecord[]>([]);

  useEffect(() => {
    if (!userUid) return;
    return subscribeNotifications(userUid, setItems);
  }, [userUid]);

  const unread = items.filter((i) => !i.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full text-[10px]">
              {unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="font-cairo">التنبيهات</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground p-4 text-center font-cairo">
            لا توجد تنبيهات
          </p>
        )}
        <div className="max-h-80 overflow-auto">
          {items.slice(0, 20).map((n) => (
            <button
              key={n.id}
              onClick={() => !n.read && markNotificationRead(n.id)}
              className={`w-full text-right px-3 py-2 border-b last:border-b-0 hover:bg-muted/40 ${
                n.read ? "opacity-70" : "bg-primary/5"
              }`}
            >
              <p className="text-sm font-semibold font-cairo">{n.title}</p>
              <p className="text-xs text-muted-foreground font-cairo">{n.body}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {n.created_at ? new Date(n.created_at).toLocaleString("ar-SA") : ""}
              </p>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsBell;
