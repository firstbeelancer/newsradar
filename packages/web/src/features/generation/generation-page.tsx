import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@shared/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui/tabs';
import { useGenerationStore } from '@shared/stores/generation-store';
import { PostGenerator } from './post-generator';
import { DigestGenerator } from './digest-generator';
import { FileText, Newspaper, Clock } from 'lucide-react';

export function GenerationPage() {
  const navigate = useNavigate();
  const { generationType, setGenerationType } = useGenerationStore();
  const [activeTab, setActiveTab] = useState(generationType === 'digest' ? 'digest' : 'post');

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setGenerationType(value === 'digest' ? 'digest' : 'post');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="nr-page-title">Генерация</h1>
          <p className="text-muted-foreground mt-1">
            Создание постов и дайджестов на основе собранных новостей
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: '/generated' })}>
          <Clock className="h-4 w-4" />
          История
        </Button>
      </div>

      {/* Type selection cards - only show on initial view */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="post">
            <FileText className="h-4 w-4 mr-1.5" />
            Пост
          </TabsTrigger>
          <TabsTrigger value="digest">
            <Newspaper className="h-4 w-4 mr-1.5" />
            Дайджест
          </TabsTrigger>
        </TabsList>

        <TabsContent value="post" className="mt-6">
          <PostGenerator />
        </TabsContent>

        <TabsContent value="digest" className="mt-6">
          <DigestGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
}
