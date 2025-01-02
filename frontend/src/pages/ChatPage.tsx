import React, { useCallback, useEffect, useLayoutEffect, useState, useRef } from 'react';
import InputChatContent from '../components/InputChatContent';
import useChat from '../hooks/useChat';
import { AttachmentType } from '../hooks/useChat';
import ChatMessage from '../components/ChatMessage';
import useScroll from '../hooks/useScroll';
import { PiArrowsCounterClockwise, PiWarningCircleFill, PiPenNib } from 'react-icons/pi';
import Button from '../components/Button';
import { useTranslation } from 'react-i18next';
import SwitchBedrockModel from '../components/SwitchBedrockModel';
import useSnackbar from '../hooks/useSnackbar';
import usePostMessageStreaming from '../hooks/usePostMessageStreaming';
import { DisplayMessageContent, Model, PutFeedbackRequest } from '../@types/conversation.ts';
import { AVAILABLE_MODEL_KEYS } from '../constants/index';
import { toCamelCase } from '../utils/StringUtils';

// Default model activation settings
const defaultActiveModels = Object.fromEntries(
  AVAILABLE_MODEL_KEYS.map((key: Model) => [toCamelCase(key), true])
);

// Example quick starters - you can modify these as needed
const quickStarters = [
  { title: "General Question", example: "Can you help me understand..." },
  { title: "Research Analysis", example: "Analyze this research paper..." },
  { title: "Literature Review", example: "Summarize the key findings in..." }
];

const ChatPage: React.FC = () => {
  const { t } = useTranslation();
  const { open: openSnackbar } = useSnackbar();
  const { errorDetail } = usePostMessageStreaming();

  const {
    agentThinking,
    conversationError,
    postingMessage,
    newChat,
    postChat,
    messages,
    conversationId,
    hasError,
    retryPostChat,
    setCurrentMessageId,
    regenerate,
    continueGenerate,
    getPostedModel,
    loadingConversation,
    getShouldContinue,
    giveFeedback,
  } = useChat();

  // Error Handling
  useEffect(() => {
    if (conversationError) {
      openSnackbar(conversationError.message ?? '');
    }
  }, [conversationError, openSnackbar]);

  const { scrollToBottom, scrollToTop } = useScroll();

  const onSend = useCallback(
    (content: string, base64EncodedImages?: string[], attachments?: AttachmentType[]) => {
      postChat({
        content,
        base64EncodedImages,
        attachments,
      });
    },
    [postChat]
  );

  const onChangeCurrentMessageId = useCallback(
    (messageId: string) => {
      setCurrentMessageId(messageId);
    },
    [setCurrentMessageId]
  );

  const onSubmitEditedContent = useCallback(
    (messageId: string, content: string) => {
      if (hasError) {
        retryPostChat({ content });
      } else {
        regenerate({ messageId, content });
      }
    },
    [hasError, regenerate, retryPostChat]
  );

  const onRegenerate = useCallback(() => {
    regenerate({});
  }, [regenerate]);

  const onContinueGenerate = useCallback(() => {
    continueGenerate({});
  }, [continueGenerate]);

  useLayoutEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    } else {
      scrollToTop();
    }
  }, [messages, scrollToBottom, scrollToTop]);

  const [dndMode, setDndMode] = useState(false);
  const onDragOver: React.DragEventHandler<HTMLDivElement> = useCallback((e) => {
    setDndMode(true);
    e.preventDefault();
  }, []);

  const endDnd: React.DragEventHandler<HTMLDivElement> = useCallback((e) => {
    setDndMode(false);
    e.preventDefault();
  }, []);

  const focusInputRef = useRef<HTMLElement | null>(null);

  const ChatMessageComponent: React.FC<{
    chatContent: DisplayMessageContent;
    isStreaming: boolean;
    onChangeMessageId?: (messageId: string) => void;
    onSubmit?: (messageId: string, content: string) => void;
    onSubmitFeedback?: (messageId: string, feedback: PutFeedbackRequest) => void;
  }> = React.memo((props) => {
    return (
      <ChatMessage
        chatContent={props.chatContent}
        isStreaming={props.isStreaming}
        onChangeMessageId={props.onChangeMessageId}
        onSubmit={props.onSubmit}
        onSubmitFeedback={props.onSubmitFeedback}
      />
    );
  });

  return (
    <div className="flex flex-col h-full">
      <div className="w-full bg-aws-paper p-4 border-b border-gray">
        <h1 className="text-3xl font-bold text-aws-squid-ink text-center">
          智能科研辅助平台
        </h1>
      </div>
      <div
        className="relative flex h-full flex-1 flex-col"
        onDragOver={onDragOver}
        onDrop={endDnd}
        onDragEnd={endDnd}>
        <div className="flex-1 overflow-hidden">
          <section className="relative size-full flex-1 overflow-auto pb-9">
            <div className="h-full">
              <div id="messages" role="presentation" className="flex h-full flex-col overflow-auto pb-16">
                {messages?.length === 0 ? (
                  <div className="relative flex w-full justify-center">
                    {!loadingConversation && (
                      <SwitchBedrockModel
                        className="mt-3 w-min"
                        activeModels={defaultActiveModels}
                      />
                    )}
                  </div>
                ) : (
                  messages?.map((message, idx, array) => (
                    <div
                      key={idx}
                      className={message.role === 'assistant' ? 'bg-aws-squid-ink/5' : ''}>
                      <ChatMessageComponent
                        chatContent={message}
                        isStreaming={postingMessage && idx + 1 === array.length}
                        onChangeMessageId={onChangeCurrentMessageId}
                        onSubmit={onSubmitEditedContent}
                        onSubmitFeedback={(messageId, feedback) => {
                          if (conversationId) {
                            giveFeedback(messageId, feedback);
                          }
                        }}
                      />
                      <div className="w-full border-b border-aws-squid-ink/10"></div>
                    </div>
                  ))
                )}

                {hasError && (
                  <div className="mb-12 mt-2 flex flex-col items-center">
                    <div className="flex items-center font-bold text-red">
                      <PiWarningCircleFill className="mr-1 text-2xl" />
                      {errorDetail ?? t('error.answerResponse')}
                    </div>
                    <Button
                      className="mt-2 shadow"
                      icon={<PiArrowsCounterClockwise />}
                      outlined
                      onClick={() => retryPostChat({})}>
                      {t('button.resend')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className={`bottom-0 z-0 flex w-full flex-col items-center justify-center ${messages.length === 0 ? 'absolute top-1/2 -translate-y-1/2' : ''}`}>
          {messages.length === 0 && (
            <div className="mb-3 flex w-11/12 flex-wrap-reverse justify-start gap-2 md:w-10/12 lg:w-4/6 xl:w-3/6">
              {quickStarters.map((qs, idx) => (
                <div
                  key={idx}
                  className="w-[calc(33.333%-0.5rem)] cursor-pointer rounded-2xl border border-aws-squid-ink/20 bg-white p-2 text-sm text-dark-gray hover:shadow-lg hover:shadow-gray"
                  onClick={() => {
                    onSend(qs.example);
                  }}>
                  <div>
                    <PiPenNib />
                  </div>
                  {qs.title}
                </div>
              ))}
            </div>
          )}

          <InputChatContent
            dndMode={dndMode}
            disabledSend={postingMessage || hasError}
            disabledRegenerate={postingMessage || hasError}
            disabledContinue={postingMessage || hasError}
            canRegenerate={messages.length > 1}
            canContinue={getShouldContinue()}
            isLoading={postingMessage}
            isNewChat={messages.length == 0}
            onSend={onSend}
            onRegenerate={onRegenerate}
            continueGenerate={onContinueGenerate}
            ref={focusInputRef}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
