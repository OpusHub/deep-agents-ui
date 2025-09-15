"use client";

import React, { useState, useEffect } from "react";
import { User, MapPin, Briefcase, Phone, Gift, Star } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import styles from "./CopyFormSidebar.module.scss";

interface CopyFormData {
  clientName: string;
  region: string;
  service: string;
  hasOffer: boolean;
  offer?: string;
  clientPhone: string;
  includeReviews: boolean;
}

interface Client {
  id: string;
  name: string;
  region?: string;
  service?: string;
  offer?: string;
  phone?: string;
  hasReviews?: boolean;
}

interface CopyFormSidebarProps {
  onSubmit: (data: CopyFormData) => void;
  isLoading: boolean;
}

// Mock de clientes para desenvolvimento
const mockClients: Client[] = [
  {
    id: "1",
    name: "João Silva - Ar Condicionado",
    region: "São Paulo - SP",
    service: "Manutenção e instalação de ar condicionado",
    phone: "(11) 99999-9999",
    offer: "20% de desconto na primeira manutenção",
    hasReviews: true,
  },
  {
    id: "2", 
    name: "Maria Santos - Limpeza",
    region: "Rio de Janeiro - RJ",
    service: "Limpeza residencial e comercial",
    phone: "(21) 88888-8888",
    hasReviews: false,
  },
  {
    id: "3",
    name: "Carlos Lima - Encanador",
    region: "Belo Horizonte - MG", 
    service: "Serviços hidráulicos em geral",
    phone: "(31) 77777-7777",
    offer: "Orçamento gratuito",
    hasReviews: true,
  },
];

export const CopyFormSidebar = React.memo<CopyFormSidebarProps>(
  ({ onSubmit, isLoading }) => {
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [formData, setFormData] = useState<CopyFormData>({
      clientName: "",
      region: "",
      service: "",
      hasOffer: false,
      offer: "",
      clientPhone: "",
      includeReviews: false,
    });

    // Auto-preencher formulário quando cliente é selecionado
    useEffect(() => {
      if (selectedClient) {
        setFormData({
          clientName: selectedClient.name,
          region: selectedClient.region || "",
          service: selectedClient.service || "",
          offer: selectedClient.offer || "",
          clientPhone: selectedClient.phone || "",
          includeReviews: selectedClient.hasReviews || false,
          hasOffer: Boolean(selectedClient.offer),
        });
      }
    }, [selectedClient]);

    const handleInputChange = (field: keyof CopyFormData, value: any) => {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    const resetForm = () => {
      setSelectedClient(null);
      setFormData({
        clientName: "",
        region: "",
        service: "",
        hasOffer: false,
        offer: "",
        clientPhone: "",
        includeReviews: false,
      });
    };

    return (
      <div className={styles.sidebar}>
        <div className={styles.header}>
          <h2 className={styles.title}>Dados do Cliente</h2>
          <p className={styles.subtitle}>Preencha as informações para gerar a copy</p>
        </div>

        <ScrollArea className={styles.content}>
          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Seletor de Cliente */}
            <div className={styles.section}>
              <Label className={styles.sectionLabel}>
                <User size={16} />
                Selecionar Cliente
              </Label>
              <Select
                value={selectedClient?.id || ""}
                onValueChange={(value) => {
                  const client = mockClients.find(c => c.id === value);
                  setSelectedClient(client || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {mockClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className={styles.clientOption}>
                        <span className={styles.clientName}>{client.name}</span>
                        <span className={styles.clientService}>{client.service}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClient && (
                <Button 
                  type="button"
                  variant="ghost" 
                  size="sm" 
                  onClick={resetForm}
                  className={styles.resetButton}
                >
                  Limpar seleção
                </Button>
              )}
            </div>

            {/* Nome do Cliente */}
            <div className={styles.field}>
              <Label htmlFor="clientName" className={styles.fieldLabel}>
                <User size={14} />
                Nome do Cliente *
              </Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => handleInputChange("clientName", e.target.value)}
                placeholder="Ex: João Silva"
                required
              />
            </div>

            {/* Região */}
            <div className={styles.field}>
              <Label htmlFor="region" className={styles.fieldLabel}>
                <MapPin size={14} />
                Região que Atende *
              </Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => handleInputChange("region", e.target.value)}
                placeholder="Ex: São Paulo - SP"
                required
              />
            </div>

            {/* Serviço */}
            <div className={styles.field}>
              <Label htmlFor="service" className={styles.fieldLabel}>
                <Briefcase size={14} />
                Serviço que Faz *
              </Label>
              <Input
                id="service"
                value={formData.service}
                onChange={(e) => handleInputChange("service", e.target.value)}
                placeholder="Ex: Manutenção de ar condicionado"
                required
              />
            </div>

            {/* Telefone */}
            <div className={styles.field}>
              <Label htmlFor="clientPhone" className={styles.fieldLabel}>
                <Phone size={14} />
                Telefone do Cliente *
              </Label>
              <Input
                id="clientPhone"
                value={formData.clientPhone}
                onChange={(e) => handleInputChange("clientPhone", e.target.value)}
                placeholder="Ex: (11) 99999-9999"
                required
              />
            </div>

            {/* Oferta */}
            <div className={styles.switchField}>
              <div className={styles.switchContainer}>
                <Switch
                  id="hasOffer"
                  checked={formData.hasOffer}
                  onCheckedChange={(checked) => handleInputChange("hasOffer", checked)}
                />
                <Label htmlFor="hasOffer" className={styles.switchLabel}>
                  <Gift size={14} />
                  Tem oferta especial?
                </Label>
              </div>
              {formData.hasOffer && (
                <Textarea
                  value={formData.offer}
                  onChange={(e) => handleInputChange("offer", e.target.value)}
                  placeholder="Ex: 20% de desconto na primeira manutenção"
                  rows={3}
                  className={styles.offerTextarea}
                />
              )}
            </div>

            {/* Reviews */}
            <div className={styles.switchField}>
              <div className={styles.switchContainer}>
                <Switch
                  id="includeReviews"
                  checked={formData.includeReviews}
                  onCheckedChange={(checked) => handleInputChange("includeReviews", checked)}
                />
                <Label htmlFor="includeReviews" className={styles.switchLabel}>
                  <Star size={14} />
                  Inserir print de review do Google?
                </Label>
              </div>
            </div>

            {/* Botão Submit */}
            <Button 
              type="submit" 
              className={styles.submitButton}
              disabled={isLoading || !formData.clientName || !formData.region || !formData.service || !formData.clientPhone}
            >
              {isLoading ? "Gerando Copy..." : "🚀 Gerar Copy com 3 Hooks"}
            </Button>
          </form>
        </ScrollArea>
      </div>
    );
  },
);

CopyFormSidebar.displayName = "CopyFormSidebar";