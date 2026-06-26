<?php

class Sales_ledger_model_test extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->CI = &get_instance();
        $this->CI->load->model('sales_ledger_model');
        $this->db = $this->CI->load->database('default', true);
        $this->db->trans_begin();
    }

    protected function tearDown(): void
    {
        if ($this->db && $this->db->conn_id) {
            $this->db->trans_rollback();
        }
        parent::tearDown();
    }

    /**
     * Test new_get_ledgers_of_producer returns valid data
     */
    public function test_new_get_ledgers_of_producer_returns_data(): void
    {
        $params = [
            'period_start' => '2025-01-01',
            'period_end' => '2026-12-31',
        ];

        $result = $this->CI->sales_ledger_model->new_get_ledgers_of_producer($params);

        // Assert success
        $this->assertIsArray($result);
        $this->assertNotEmpty($result);
        $this->assertArrayHasKey('is_success', $result);
        $this->assertArrayHasKey('data', $result);
        $this->assertArrayHasKey('total_rows', $result);

        // Assert data is available
        $this->assertTrue($result['is_success']);
        $this->assertNotEmpty($result['data']);
        $this->assertTrue($result['total_rows'] > 0);
    }

    /**
     * Test new_get_ledgers_of_producer with all optional query filters
     */
    public function test_new_get_ledgers_of_producer_with_optional_filters_returns_without_error(): void
    {
        $params = [
            'period_start' => '2026-01-01',
            'period_end' => '2026-02-01',
            'producer_id' => 1,
            'vending_machine_id' => true,
            'payment_method_id' => 1,
            'ex_donation_only' => true,
        ];

        $result = $this->CI->sales_ledger_model->new_get_ledgers_of_producer($params);

        // Assert success
        $this->assertIsArray($result);
        $this->assertNotEmpty($result);
        $this->assertArrayHasKey('is_success', $result);
        $this->assertArrayHasKey('data', $result);
    }
}
