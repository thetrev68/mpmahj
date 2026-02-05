/**
 * RoomCard Component
 *
 * Displays a single room in the lobby with name, players, status, etc.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LobbyRoomInfo } from '@/stores/roomStore';

export interface RoomCardProps {
  room: LobbyRoomInfo;
  onJoinClick: (room: LobbyRoomInfo) => void;
}

export function RoomCard({ room, onJoinClick }: RoomCardProps) {
  const isJoinable = room.status === 'Waiting' && room.players_count < room.max_players;
  const statusVariant =
    room.status === 'Waiting' ? 'default' : room.status === 'InProgress' ? 'secondary' : 'destructive';

  return (
    <Card role="article" className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {room.room_name}
          <Badge variant={statusVariant}>{room.status}</Badge>
        </CardTitle>
        <CardDescription>
          Host: {room.host_name || room.host_player_id}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>Players:</span>
          <span className="font-semibold">
            {room.players_count}/{room.max_players}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Card Year:</span>
          <Badge variant="outline">{room.card_year}</Badge>
        </div>
        {room.house_rules_summary && room.house_rules_summary.length > 0 && (
          <div className="space-y-1">
            <span className="text-sm">House Rules:</span>
            <div className="flex flex-wrap gap-1">
              {room.house_rules_summary.map((rule, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {rule}
                </Badge>
              ))}
            </div>
          </div>
        )}
        <Button
          onClick={() => onJoinClick(room)}
          disabled={!isJoinable}
          className="w-full"
          variant={isJoinable ? 'default' : 'outline'}
        >
          {isJoinable ? 'Join' : room.status === 'Full' ? 'Full' : 'In Progress'}
        </Button>
      </CardContent>
    </Card>
  );
}
