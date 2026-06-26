<?php

require_once APPPATH . 'tests/traits/AuthTestTrait.php';

class Sales_ledger_test extends TestCase
{
    use AuthTestTrait;

    protected const ROUTE_LIST = 'sales_ledger';

    /**
     * Table header columns to assert
     */
    private const EXPECTED_TABLE_COLUMNS = ['発送日', '受注番号', '商品名', '注文商品数', '顧客名', '金額(消費税不課税)'];

    /**
     * CSV header columns to assert
     */
    private const EXPECTED_CSV_COLUMNS = ['寄附日', '発送日', '受注番号', '商品コード', '商品名(１件目のみ表示)', '決済方法', '顧客名', '金額（不課税）'];

    protected function setUp(): void
    {
        parent::setUp();

        $this->CI = &get_instance();
        $this->CI->load->library('session');
        $this->db = $this->CI->load->database('default', true);

        // Inject db
        $this->request->setCallablePreConstructor(function () {
            load_class_instance('db', $this->db);
        });

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
     * Test list screen displays successfully
     */
    public function test_list_screen_displayed_successfully(): void
    {
        $this->login(ADMIN_ROLE_MAIN_SITE_ADMINISTRATOR);

        $response = $this->request('GET', self::ROUTE_LIST);

        // Assert page display
        $this->assertResponseCode(200);
        $this->assertStringContainsString('寄附額集計', $response);
    }

    /**
     * Test search on list screen runs successfully
     */
    public function test_list_screen_search_successfully(): void
    {
        $this->login(ADMIN_ROLE_MAIN_SITE_ADMINISTRATOR);

        $mock_ledger_types = [
            [
                'order_id' => '6112045',
                'order_code' => 'T25-3D5-EE30NK',
                'juchubi' => '2025/01/16',
                'purchased_at' => '2025/01/16',
                'price' => '22000',
                'price_detail' => '22000',
                'payment_amount' => '0',
                'vending_machine_id' => null,
                'consumer_sei' => 'あ',
                'consumer_mei' => 'い',
                'payment_name' => 'クレジット',
                'name' => '湯河原惣湯「惣湯テラス」ご利用券1枚',
                'order_detail_status_id' => '5',
                'occurrence_date' => '2025/01/20',
                'product_code' => 'c-1',
                'producer_name' => '湯河原惣湯 ',
                'num' => '1',
                'product_id_count' => '1',
                'total_items' => '1',
                'price_incTax' => '7150',
                'maker_price' => '6500',
                'delivery_date' => '2025/01/20',
                'invoice_item_id' => '0',
                'affiliater_id' => '2500065',
                'work_organization_name' => '湯河原惣湯 ',
            ],
        ];

        // Mock ledger type data to isolate the test from database data
        // and verify that the search result renders expected values.
        $this->request->setCallable(function () use ($mock_ledger_types) {
            $CI = &get_instance();

            $sales_ledger_model_mock = $this->createPartialMock(
                get_class($CI->sales_ledger_model),
                ['new_get_orders_of_tax']
            );

            $sales_ledger_model_mock->method('new_get_orders_of_tax')->willReturn([
                'is_success' => true,
                'data' => $mock_ledger_types,
                'total_rows' => count($mock_ledger_types),
            ]);

            $CI->sales_ledger_model = $sales_ledger_model_mock; // Inject
        });

        $response = $this->request('GET', self::ROUTE_LIST, [
            'do_search' => 1,
            'period_type' => BILL_PERIOD_MONTH,
            'month_select' => '2025/01',
            'select_client' => SALES_LEDGER_CLIENT_SALES,
        ]);

        // Assert page display
        $this->assertResponseCode(200);
        $this->assertStringContainsString('寄附額集計', $response);

        foreach (self::EXPECTED_TABLE_COLUMNS as $header) {
            $this->assertStringContainsString($header, $response);
        }

        // Assert row data
        $row = $mock_ledger_types[0];
        $expected_values = [
            $row['purchased_at'],
            $row['delivery_date'],
            $row['order_code'],
            $row['name'],
            $row['num'],
            $row['consumer_mei'],
            $row['total_items'],
            number_format((int) $row['price']),
        ];

        foreach ($expected_values as $value) {
            $this->assertStringContainsString((string) $value, $response);
        }
    }

    /**
     * Test CSV export executes successfully.
     */
    public function test_export_csv_successfully(): void
    {
        $this->login(ADMIN_ROLE_MAIN_SITE_ADMINISTRATOR);

        $response = $this->request('GET', self::ROUTE_LIST, [
            'do_output_csv' => 1,
            'period_type' => BILL_PERIOD_MONTH,
            'month_select' => '2025/01',
            'select_client' => SALES_LEDGER_CLIENT_SALES,
        ]);

        // Assert success
        $this->assertResponseCode(200);
        $this->assertNotEmpty($response);

        // Assert CSV columns
        foreach (self::EXPECTED_CSV_COLUMNS as $column) {
            $this->assertStringContainsString($column, $response);
        }

        // Assert CSV value
        $this->assertStringContainsString('2025/01', $response);
    }

    /**
     * Test CSV export executes successfully with no data.
     */
    public function test_export_csv_with_no_data(): void
    {
        $this->login(ADMIN_ROLE_MAIN_SITE_ADMINISTRATOR);

        $response = $this->request('GET', self::ROUTE_LIST, [
            'do_output_csv' => 1,
            'period_type' => BILL_PERIOD_MONTH,
            'month_select' => '1000/01',
            'select_client' => SALES_LEDGER_CLIENT_SALES,
        ]);

        // Assert success
        $this->assertResponseCode(200);
        $this->assertNotEmpty($response);

        // Assert CSV columns
        foreach (self::EXPECTED_CSV_COLUMNS as $header) {
            $this->assertStringContainsString($header, $response);
        }

        // Assert CSV value is empty
        $this->assertStringNotContainsString('1000/01', $response);
    }

    /**
     * Test PDF export executes successfully with data
     */
    public function test_export_pdf_successfully(): void
    {
        $this->login(ADMIN_ROLE_MAIN_SITE_ADMINISTRATOR);

        $start_level = ob_get_level();
        ob_start();

        $response = $this->request('GET', self::ROUTE_LIST, [
            'do_output_pdf' => 1,
            'period_type' => BILL_PERIOD_MONTH,
            'month_select' => '2025/01',
            'select_client' => SALES_LEDGER_CLIENT_SALES,
        ]);

        if (ob_get_level() > $start_level) {
            @ob_end_clean();
        }

        // Assert success
        $this->assertResponseCode(200);
        $this->assertStringContainsString('PDF-', $response);
    }

    /**
     * Test PDF export handles empty results gracefully
     */
    public function test_export_pdf_with_no_data(): void
    {
        $this->login(ADMIN_ROLE_MAIN_SITE_ADMINISTRATOR);

        $start_level = ob_get_level();
        ob_start();

        $response = $this->request('GET', self::ROUTE_LIST, [
            'do_output_pdf' => 1,
            'period_type' => BILL_PERIOD_MONTH,
            'month_select' => '1000/01',
            'select_client' => SALES_LEDGER_CLIENT_SALES,
        ]);

        if (ob_get_level() > $start_level) {
            @ob_end_clean();
        }

        // Assert page display
        $this->assertResponseCode(200);
        $this->assertStringContainsString('寄附額集計', $response);

        // Assert no data error message
        $this->assertStringContainsString('現在、出力できるデータがありません。', $response);
    }
}
